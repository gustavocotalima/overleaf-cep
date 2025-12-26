import { google } from 'googleapis'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { UserGoogleDriveAuth } from './UserGoogleDriveAuth.js'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

class GoogleDriveClient {
  constructor() {
    this._oauth2Client = null
  }

  _getOAuth2Client() {
    if (!this._oauth2Client) {
      const { clientId, clientSecret, redirectUri } = Settings.googleDriveBackup || {}
      if (!clientId || !clientSecret) {
        throw new Error('Google Drive not configured: missing clientId or clientSecret')
      }
      this._oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    }
    return this._oauth2Client
  }

  getAuthUrl(userId, returnTo = null) {
    const oauth2Client = this._getOAuth2Client()
    const state = JSON.stringify({ userId: userId.toString(), returnTo })
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    })
  }

  async handleCallback(code, userId) {
    // Create a fresh OAuth2 client for callback handling to avoid shared state issues
    const { clientId, clientSecret, redirectUri } = Settings.googleDriveBackup || {}
    const callbackClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    const { tokens } = await callbackClient.getToken(code)

    // Get user's Google email using the authenticated client
    callbackClient.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: callbackClient })
    const userInfo = await oauth2.userinfo.get()
    const email = userInfo.data.email

    // Upsert user's auth record
    const authRecord = await UserGoogleDriveAuth.findOneAndUpdate(
      { userId },
      {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        connectedAt: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    )

    logger.info({ userId, email }, 'User connected Google Drive')
    return authRecord
  }

  async _getAuthenticatedClientForUser(userId) {
    const authRecord = await UserGoogleDriveAuth.findOne({ userId, isActive: true })
    if (!authRecord) {
      throw new Error('Google Drive not connected. Please connect your Google Drive first.')
    }

    const oauth2Client = this._getOAuth2Client()
    oauth2Client.setCredentials({
      access_token: authRecord.accessToken,
      refresh_token: authRecord.refreshToken,
      expiry_date: authRecord.expiresAt ? authRecord.expiresAt.getTime() : null,
      token_type: authRecord.tokenType,
    })

    // Handle token refresh
    oauth2Client.on('tokens', async tokens => {
      if (tokens.access_token) {
        await UserGoogleDriveAuth.updateOne(
          { _id: authRecord._id },
          {
            accessToken: tokens.access_token,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          }
        )
        logger.debug({ userId }, 'Google Drive access token refreshed')
      }
    })

    return oauth2Client
  }

  async _getDriveForUser(userId) {
    const auth = await this._getAuthenticatedClientForUser(userId)
    return google.drive({ version: 'v3', auth })
  }

  async isUserConnected(userId) {
    const authRecord = await UserGoogleDriveAuth.findOne({ userId, isActive: true })
    return !!authRecord
  }

  async getUserConnectionStatus(userId) {
    const authRecord = await UserGoogleDriveAuth.findOne({ userId, isActive: true })
    if (!authRecord) {
      return { connected: false }
    }
    return {
      connected: true,
      email: authRecord.email,
      connectedAt: authRecord.connectedAt,
    }
  }

  async disconnectUser(userId) {
    await UserGoogleDriveAuth.updateOne(
      { userId },
      { isActive: false }
    )
    logger.info({ userId }, 'User disconnected Google Drive')
  }

  async listFolders(userId, parentId = 'root') {
    const drive = await this._getDriveForUser(userId)

    const query = parentId === 'root'
      ? "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false"
      : `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, parents)',
      pageSize: 100,
      orderBy: 'name',
    })

    return response.data.files || []
  }

  async listZipFiles(userId, folderId = 'root') {
    const drive = await this._getDriveForUser(userId)

    const query = folderId === 'root'
      ? "mimeType='application/zip' and 'root' in parents and trashed=false"
      : `mimeType='application/zip' and '${folderId}' in parents and trashed=false`

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, size, createdTime, modifiedTime)',
      pageSize: 100,
      orderBy: 'modifiedTime desc',
    })

    return response.data.files || []
  }

  async searchZipFiles(userId, query = '') {
    const drive = await this._getDriveForUser(userId)

    let searchQuery = "mimeType='application/zip' and trashed=false"
    if (query) {
      searchQuery += ` and name contains '${query.replace(/'/g, "\\'")}'`
    }

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, size, createdTime, modifiedTime, parents)',
      pageSize: 50,
      orderBy: 'modifiedTime desc',
    })

    return response.data.files || []
  }

  async uploadFile(userId, stream, fileName, folderId = 'root') {
    const drive = await this._getDriveForUser(userId)

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    }

    const media = {
      mimeType: 'application/zip',
      body: stream,
    }

    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, size, webViewLink, webContentLink',
    })

    logger.info({ userId, fileId: response.data.id, fileName }, 'Uploaded file to Google Drive')

    return {
      fileId: response.data.id,
      name: response.data.name,
      size: parseInt(response.data.size, 10),
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    }
  }

  async downloadFile(userId, fileId) {
    const drive = await this._getDriveForUser(userId)

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )

    return response.data
  }

  async getFileMetadata(userId, fileId) {
    const drive = await this._getDriveForUser(userId)

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, size, mimeType, createdTime, modifiedTime, webViewLink',
    })

    return response.data
  }

  async getFolderPath(userId, folderId) {
    if (folderId === 'root') {
      return [{ id: 'root', name: 'My Drive' }]
    }

    const drive = await this._getDriveForUser(userId)
    const path = []

    let currentId = folderId
    while (currentId && currentId !== 'root') {
      const response = await drive.files.get({
        fileId: currentId,
        fields: 'id, name, parents',
      })

      path.unshift({ id: response.data.id, name: response.data.name })

      if (response.data.parents && response.data.parents.length > 0) {
        currentId = response.data.parents[0]
      } else {
        break
      }
    }

    path.unshift({ id: 'root', name: 'My Drive' })
    return path
  }

  async testConnection(userId) {
    try {
      const drive = await this._getDriveForUser(userId)
      const response = await drive.about.get({ fields: 'user' })
      return {
        success: true,
        email: response.data.user.emailAddress,
      }
    } catch (error) {
      logger.error({ err: error, userId }, 'Google Drive connection test failed')
      return { success: false, error: error.message }
    }
  }
}

// Singleton instance
const googleDriveClient = new GoogleDriveClient()

export default googleDriveClient
