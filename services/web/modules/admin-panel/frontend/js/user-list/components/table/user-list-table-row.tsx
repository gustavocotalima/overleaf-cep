import { memo, useMemo } from 'react'
import getMeta from '@/utils/meta'
import EmailCell from './cells/email-cell'
import LastActiveCell from './cells/last-active-cell'
import SignUpDateCell from './cells/sign-up-date-cell'
import DeletedAtCell from './cells/deleted-at-cell'
import ActionsCell from './cells/actions-cell'
import ActionsDropdown from '../dropdown/actions-dropdown'
import { User } from '../../../../../types/api'
import { UserCheckbox } from './user-checkbox'

type UserListTableRowProps = {
  user: User
  selected: boolean
  filter: string
}
function UserListTableRow({ user, selected, filter }: UserListTableRowProps) {
  const first = user.first_name?.trim() || '[Noname]'
  const last = user.last_name?.trim() || '[Noname]'
  const fullName = `${first} ${last}`

  const isSelf = useMemo(() => {
    return getMeta('ol-user_id') === user.id
  }, [user])

  return (
    <tr className={selected ? 'table-active' : undefined}>
      <td className="dash-cell-checkbox d-none d-md-table-cell">
        <UserCheckbox userId={user.id} userName={user.email} />
      </td>
      <td className="dash-cell-name">
        <a href={`/user/${user.id}`} translate="no">
          {fullName}
        </a>{' '}
      </td>
      <td className="dash-cell-email-date pb-0 d-md-none">
        <span> <EmailCell user={user} /> — <LastActiveCell user={user} /></span>
      </td>
      <td className="dash-cell-email d-none d-md-table-cell">
        <EmailCell user={user} />
      </td>
      {filter !== 'deleted' ? (
        <td className="dash-cell-date-signup d-none d-md-table-cell">
          <SignUpDateCell user={user} />
        </td>
      ) : (
        <td className="dash-cell-date-signup d-none d-md-table-cell">
          <DeletedAtCell user={user} />
        </td>
      )}
      <td className="dash-cell-date-active d-none d-md-table-cell">
        <LastActiveCell user={user} />
      </td>
      <td className="dash-cell-actions">
        <div className="d-none d-lg-block">
          { !isSelf && <ActionsCell user={user} />}
        </div>
        <div className="d-lg-none">
          { !isSelf && <ActionsDropdown user={user} />}
        </div>
      </td>
    </tr>
  )
}
export default memo(UserListTableRow)
