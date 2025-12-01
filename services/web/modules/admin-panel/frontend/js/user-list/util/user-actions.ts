import { User } from '../../../../types/api'
import { deleteUser, purgeUser, restoreUser, flagUser } from './api'

export type AfterActions = {
  toggleSelectedUser?: (id: string, selected: boolean) => void
  updateUserViewData?: (user: User) => void
  removeUserFromView?: (user: User) => void
}

export function performDeleteUser(
  user: User,
  doAfter: AfterActions,
  options: { sendEmail: boolean },
) {

  return deleteUser(user.id, options.sendEmail).then(data => {
    doAfter.toggleSelectedUser(user.id, false)
    doAfter.updateUserViewData({
      ...user,
      ...data,
      deleted: true,
    })
  })
}

export function performFlagUser(
  user: User,
  doAfter: AfterActions,
  options: string,
) {

  let flag
  switch (options) {
    case 'set_admin':
      flag = { isAdmin: true }
      break
    case 'unset_admin':
      flag = { isAdmin: false }
      break
    case 'suspend':
      flag = { suspended: true }
      break
    case 'resume':
      flag = { suspended: false }
      break
    default:
      return
  }

  return flagUser(user.id, flag).then(() => {
    doAfter.toggleSelectedUser(user.id, false)
    doAfter.updateUserViewData({
      ...user,
      ...flag
    })
  })

}

export function performRestoreUser(
  user: User,
  doAfter: AfterActions,
) {

  return restoreUser(user.id).then(() => {
    doAfter.toggleSelectedUser(user.id, false)
    doAfter.updateUserViewData({
      ...user,
      deletedId: undefined,
      deletedAt: undefined,
      deleted: false,
      suspended: false,
    })
  })
}

export function performPurgeUser(
  user: User,
  doAfter: AfterActions
) {
  return purgeUser(user.id).then(() => {
    doAfter.removeUserFromView(user)
  })
}
