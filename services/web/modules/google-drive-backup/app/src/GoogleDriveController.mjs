import logger from '@overleaf/logger'
import { promisify } from 'util'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import ProjectGetter from '../../../../app/src/Features/Project/ProjectGetter.mjs'
import ProjectZipStreamManager from '../../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs'
import googleDriveClient from './GoogleDriveClient.mjs'
import { ProjectExport } from './ProjectExport.mjs'

const createZipStreamForProject = promisify(ProjectZipStreamManager.createZipStreamForProject.bind(ProjectZipStreamManager))

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200)
}

// ============ OAuth Endpoints ============

async function connectGoogleDrive(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const returnTo = req.query.returnTo || '/project'
    const authUrl = googleDriveClient.getAuthUrl(user._id, returnTo)
    res.redirect(authUrl)
  } catch (error) {
    logger.error({ err: error }, 'Failed to start Google Drive connection')
    next(error)
  }
}

async function handleOAuthCallback(req, res, next) {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) {
      logger.warn({ oauthError }, 'Google Drive OAuth error')
      return res.redirect('/project?google-drive-error=denied')
    }

    if (!code) {
      return res.redirect('/project?google-drive-error=no_code')
    }

    let stateData = {}
    try {
      stateData = JSON.parse(state)
    } catch (e) {
      // Ignore parse error
    }

    const user = SessionManager.getSessionUser(req.session)
    await googleDriveClient.handleCallback(code, user._id)

    const returnTo = stateData.returnTo || '/project'
    res.redirect(`${returnTo}?google-drive-connected=true`)
  } catch (error) {
    logger.error({ err: error }, 'Failed to handle Google Drive OAuth callback')
    res.redirect('/project?google-drive-error=callback_failed')
  }
}

async function getConnectionStatus(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const status = await googleDriveClient.getUserConnectionStatus(user._id)
    res.json(status)
  } catch (error) {
    logger.error({ err: error }, 'Failed to get Google Drive connection status')
    next(error)
  }
}

async function disconnectGoogleDrive(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    await googleDriveClient.disconnectUser(user._id)
    res.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect Google Drive')
    next(error)
  }
}

// ============ Folder Browsing Endpoints ============

async function listFolders(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { parentId = 'root' } = req.query

    const folders = await googleDriveClient.listFolders(user._id, parentId)
    const path = await googleDriveClient.getFolderPath(user._id, parentId)

    res.json({ folders, path })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list Google Drive folders')
    next(error)
  }
}

async function listFiles(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { folderId = 'root', search } = req.query

    let files
    if (search) {
      files = await googleDriveClient.searchZipFiles(user._id, search)
    } else {
      files = await googleDriveClient.listZipFiles(user._id, folderId)
    }

    const path = await googleDriveClient.getFolderPath(user._id, folderId)

    res.json({ files, path })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list Google Drive files')
    next(error)
  }
}

async function createFolder(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { name, parentId = 'root' } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' })
    }

    const folder = await googleDriveClient.createFolder(user._id, name.trim(), parentId)
    res.json(folder)
  } catch (error) {
    logger.error({ err: error }, 'Failed to create Google Drive folder')
    next(error)
  }
}

// ============ Export Endpoints ============

async function exportProject(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { Project_id: projectId } = req.params
    const { folderId = 'root', fileName } = req.body

    // Check connection
    const isConnected = await googleDriveClient.isUserConnected(user._id)
    if (!isConnected) {
      return res.status(400).json({ error: 'Google Drive not connected' })
    }

    // Get project
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
      version: 1,
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Generate filename
    const exportFileName = fileName || `${sanitizeFileName(project.name)}-${formatDate(new Date())}.zip`

    // Create ZIP stream
    const zipStream = await createZipStreamForProject(projectId)

    // Upload to Drive
    const uploadResult = await googleDriveClient.uploadFile(
      user._id,
      zipStream,
      exportFileName,
      folderId
    )

    // Save export record
    const exportRecord = new ProjectExport({
      projectId,
      userId: user._id,
      driveFileId: uploadResult.fileId,
      driveFolderId: folderId,
      driveFileName: exportFileName,
      driveFileUrl: uploadResult.webViewLink,
      fileSize: uploadResult.size,
      projectVersion: project.version,
      projectName: project.name,
    })
    await exportRecord.save()

    logger.info({ projectId, userId: user._id, driveFileId: uploadResult.fileId }, 'Project exported to Google Drive')

    res.json({
      success: true,
      fileId: uploadResult.fileId,
      fileName: exportFileName,
      fileSize: uploadResult.size,
      webViewLink: uploadResult.webViewLink,
    })
  } catch (error) {
    logger.error({ err: error, projectId: req.params.Project_id }, 'Failed to export project')
    next(error)
  }
}

async function getProjectExports(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { Project_id: projectId } = req.params

    const exports = await ProjectExport.find({
      projectId,
      userId: user._id,
    })
      .sort({ exportedAt: -1 })
      .limit(10)
      .lean()

    res.json({ exports })
  } catch (error) {
    logger.error({ err: error, projectId: req.params.Project_id }, 'Failed to get project exports')
    next(error)
  }
}

async function getLatestExport(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { Project_id: projectId } = req.params

    const latestExport = await ProjectExport.findOne({
      projectId,
      userId: user._id,
    })
      .sort({ exportedAt: -1 })
      .lean()

    if (!latestExport) {
      return res.json({ hasExport: false })
    }

    res.json({
      hasExport: true,
      export: {
        exportedAt: latestExport.exportedAt,
        fileName: latestExport.driveFileName,
        webViewLink: latestExport.driveFileUrl,
      },
    })
  } catch (error) {
    logger.error({ err: error, projectId: req.params.Project_id }, 'Failed to get latest export')
    next(error)
  }
}

// ============ Import Endpoints ============

async function importFromDrive(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { fileId, projectName } = req.body

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' })
    }

    // Check connection
    const isConnected = await googleDriveClient.isUserConnected(user._id)
    if (!isConnected) {
      return res.status(400).json({ error: 'Google Drive not connected' })
    }

    // Get file metadata
    const fileMetadata = await googleDriveClient.getFileMetadata(user._id, fileId)

    if (fileMetadata.mimeType !== 'application/zip') {
      return res.status(400).json({ error: 'File must be a ZIP archive' })
    }

    // Download file
    const fileStream = await googleDriveClient.downloadFile(user._id, fileId)

    // Import using existing project upload logic
    const ProjectUploadManager = (await import('../../../../app/src/Features/Uploads/ProjectUploadManager.mjs')).default

    const name = projectName || fileMetadata.name.replace(/\.zip$/i, '')

    // Create temp file and import
    const FileWriter = (await import('../../../../app/src/infrastructure/FileWriter.mjs')).default
    const tempPath = await FileWriter.promises.writeStreamToDisk('google-drive-import', fileStream)

    try {
      const project = await ProjectUploadManager.promises.createProjectFromZipArchive(
        user._id,
        name,
        tempPath
      )

      logger.info({ userId: user._id, projectId: project._id, driveFileId: fileId }, 'Project imported from Google Drive')

      res.json({
        success: true,
        projectId: project._id,
        projectName: project.name,
      })
    } finally {
      // Clean up temp file
      const fs = await import('fs/promises')
      try {
        await fs.unlink(tempPath)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to import from Google Drive')
    next(error)
  }
}

async function importIntoCurrentProject(req, res, next) {
  try {
    const user = SessionManager.getSessionUser(req.session)
    const { Project_id: projectId } = req.params
    const { fileId } = req.body

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' })
    }

    const isConnected = await googleDriveClient.isUserConnected(user._id)
    if (!isConnected) {
      return res.status(400).json({ error: 'Google Drive not connected' })
    }

    const fileMetadata = await googleDriveClient.getFileMetadata(user._id, fileId)
    if (fileMetadata.mimeType !== 'application/zip') {
      return res.status(400).json({ error: 'File must be a ZIP archive' })
    }

    // Get project root folder
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
      rootFolder: 1,
    })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    const rootFolderId = project.rootFolder[0]._id

    // Download from Google Drive
    const fileStream = await googleDriveClient.downloadFile(user._id, fileId)

    const FileWriter = (await import('../../../../app/src/infrastructure/FileWriter.mjs')).default
    const tempPath = await FileWriter.promises.writeStreamToDisk('google-drive-import', fileStream)

    try {
      const ArchiveManager = (await import('../../../../app/src/Features/Uploads/ArchiveManager.mjs')).default
      const FileSystemImportManager = (await import('../../../../app/src/Features/Uploads/FileSystemImportManager.mjs')).default
      const Path = (await import('node:path')).default
      const fs = await import('node:fs/promises')

      const contentsPath = `${tempPath}-contents-${Date.now()}`
      await ArchiveManager.promises.extractZipArchive(tempPath, contentsPath)

      try {
        const topLevelDir = await ArchiveManager.promises.findTopLevelDirectory(contentsPath)
        const entries = await fs.readdir(topLevelDir)

        for (const entry of entries) {
          const entryPath = Path.join(topLevelDir, entry)
          await FileSystemImportManager.promises.addEntity(
            user._id,
            projectId,
            rootFolderId,
            entry,
            entryPath,
            true // replace existing files
          )
        }

        logger.info(
          { userId: user._id, projectId, driveFileId: fileId },
          'Project updated from Google Drive ZIP'
        )

        res.json({
          success: true,
          projectId: project._id,
          projectName: project.name,
        })
      } finally {
        await fs.rm(contentsPath, { recursive: true, force: true }).catch(() => {})
      }
    } finally {
      const fs = await import('node:fs/promises')
      await fs.unlink(tempPath).catch(() => {})
    }
  } catch (error) {
    logger.error({ err: error, projectId: req.params.Project_id }, 'Failed to import into current project from Google Drive')
    next(error)
  }
}

export default {
  // OAuth
  connectGoogleDrive,
  handleOAuthCallback,
  getConnectionStatus,
  disconnectGoogleDrive,
  // Folder browsing
  listFolders,
  listFiles,
  createFolder,
  // Export
  exportProject,
  getProjectExports,
  getLatestExport,
  // Import
  importFromDrive,
  importIntoCurrentProject,
}
