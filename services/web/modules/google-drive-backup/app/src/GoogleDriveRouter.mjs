import logger from '@overleaf/logger'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'
import GoogleDriveController from './GoogleDriveController.mjs'

export default {
  apply(webRouter) {
    logger.debug({}, 'Init Google Drive router')

    // OAuth flow
    webRouter.get(
      '/user/google-drive/connect',
      AuthenticationController.requireLogin(),
      GoogleDriveController.connectGoogleDrive
    )

    webRouter.get(
      '/user/google-drive/callback',
      AuthenticationController.requireLogin(),
      GoogleDriveController.handleOAuthCallback
    )

    webRouter.get(
      '/user/google-drive/status',
      AuthenticationController.requireLogin(),
      GoogleDriveController.getConnectionStatus
    )

    webRouter.delete(
      '/user/google-drive/disconnect',
      AuthenticationController.requireLogin(),
      GoogleDriveController.disconnectGoogleDrive
    )

    // Folder and file browsing
    webRouter.get(
      '/user/google-drive/folders',
      AuthenticationController.requireLogin(),
      GoogleDriveController.listFolders
    )

    webRouter.get(
      '/user/google-drive/files',
      AuthenticationController.requireLogin(),
      GoogleDriveController.listFiles
    )

    webRouter.post(
      '/user/google-drive/folders',
      AuthenticationController.requireLogin(),
      GoogleDriveController.createFolder
    )

    // Export
    webRouter.post(
      '/project/:Project_id/google-drive/export',
      AuthenticationController.requireLogin(),
      GoogleDriveController.exportProject
    )

    webRouter.get(
      '/project/:Project_id/google-drive/exports',
      AuthenticationController.requireLogin(),
      GoogleDriveController.getProjectExports
    )

    webRouter.get(
      '/project/:Project_id/google-drive/latest-export',
      AuthenticationController.requireLogin(),
      GoogleDriveController.getLatestExport
    )

    // Import - new project
    webRouter.post(
      '/project/google-drive/import',
      AuthenticationController.requireLogin(),
      GoogleDriveController.importFromDrive
    )

    // Import - into existing project
    webRouter.post(
      '/project/:Project_id/google-drive/import',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      GoogleDriveController.importIntoCurrentProject
    )
  },
}
