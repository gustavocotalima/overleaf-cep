import classnames from 'classnames'
import { User } from '../../../../../types/api'

type UsersToDisplayProps = {
  users: User[]
  usersToDisplay: User[]
}

function UsersList({ users, usersToDisplay }: UsersToDisplayProps) {
  return (
    <ul>
      {usersToDisplay.map(user => (
        <li
          key={`users-action-list-${user.id}`}
          className={classnames({
            'list-style-check-green': !users.some(
              ({ id }) => id === user.id
            ),
          })}
        >
          <b>{`${user.first_name} ${user.last_name} (${user.email})`}</b>
        </li>
      ))}
    </ul>
  )
}

export default UsersList
