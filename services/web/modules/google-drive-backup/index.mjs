import Settings from '@overleaf/settings'
import GoogleDriveRouter from './app/src/GoogleDriveRouter.mjs'

let GoogleDriveModule = {}

if (process.env.OVERLEAF_GOOGLE_DRIVE_BACKUP === 'true') {
  // Configure settings
  Settings.googleDriveBackup = {
    enabled: true,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${Settings.siteUrl}/user/google-drive/callback`,
    exportWarningDays: parseInt(process.env.GOOGLE_DRIVE_EXPORT_WARNING_DAYS, 10) || 7,
  }

  GoogleDriveModule = {
    router: GoogleDriveRouter,
  }
}

export default GoogleDriveModule
