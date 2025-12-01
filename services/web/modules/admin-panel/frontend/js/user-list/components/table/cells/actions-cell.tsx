import { DeleteUserButtonTooltip } from './action-buttons/delete-user-button'
import { RestoreUserButtonTooltip } from './action-buttons/restore-user-button'
import { PurgeUserButtonTooltip } from './action-buttons/purge-user-button'
import { FlagUserButtonTooltip } from './action-buttons/flag-user-button'
import { User } from '../../../../../../types/api'

type ActionsCellProps = {
  user: User
}

export default function ActionsCell({ user }: ActionsCellProps) {
  return (
    <>
      <FlagUserButtonTooltip user={user} flag={'isAdmin'} />
      <FlagUserButtonTooltip user={user} flag={'suspended'} />
      <DeleteUserButtonTooltip user={user} />
      <RestoreUserButtonTooltip user={user} />
      <PurgeUserButtonTooltip user={user} />
    </>
  )
}
