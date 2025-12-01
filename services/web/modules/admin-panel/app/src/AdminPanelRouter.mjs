import logger from '@overleaf/logger'
import UserListController from './UserListController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'

export default {
  apply(webRouter) {
    logger.debug({}, 'Init AdminPanel router')

    webRouter.get('/admin/user',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.userListPage
    )
    webRouter.post(
      '/admin/register',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.registerNewUser
    )
    webRouter.post('/api/user',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.getUsersJson
    )
    webRouter.post('/admin/user/:userId/delete',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.deleteNormalUser
    )
    webRouter.delete('/admin/user/:userId',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.purgeDeletedUser
    )
    webRouter.post('/admin/user/:userId/restore',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.restoreDeletedUser
    )
    webRouter.post('/admin/user/:userId/flag',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserListController.flagUser
    )

  },
}
