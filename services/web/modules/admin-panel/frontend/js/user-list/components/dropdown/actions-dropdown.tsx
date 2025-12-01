import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import FlagUserButton from '../table/cells/action-buttons/flag-user-button'
import DeleteUserButton from '../table/cells/action-buttons/delete-user-button'
import RestoreUserButton from '../table/cells/action-buttons/restore-user-button'
import PurgeUserButton from '../table/cells/action-buttons/purge-user-button'
import { User } from '../../../../../types/api'

type ActionDropdownProps = {
  user: User
}

function ActionsDropdown({ user }: ActionDropdownProps) {
  const { t } = useTranslation()


  const flagActions = [
    { action: 'set_admin', icon: 'add_moderator', unfilled: true },
    { action: 'unset_admin', icon: 'remove_moderator', unfilled: true },
    { action: 'suspend', icon: 'pause', unfilled: false },
    { action: 'resume', icon: 'resume', unfilled: false },
  ]

  return (
    <Dropdown align="end">
      <DropdownToggle
        id={`user-actions-dropdown-toggle-btn-${user.id}`}
        bsPrefix="dropdown-table-button-toggle"
      >
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </DropdownToggle>
      <DropdownMenu flip={false}>
        {flagActions.map(({ action, icon, unfilled }) => (
          <FlagUserButton key={action} user={user} action={action}>
            {(text, handleOpenModal) => (
              <li role="none">
                <DropdownItem
                  as="button"
                  tabIndex={-1}
                  onClick={handleOpenModal}
                  leadingIcon={icon}
                  unfilled={unfilled}
                >
                  {text}
                </DropdownItem>
              </li>
            )}
          </FlagUserButton>
        ))}
        <DeleteUserButton user={user}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="delete"
                unfilled
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </DeleteUserButton>
        <RestoreUserButton user={user}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="restore_from_trash"
                unfilled
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </RestoreUserButton>
        <PurgeUserButton user={user}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem 
                as="button" 
                tabIndex={-1} 
                onClick={handleOpenModal}
                leadingIcon="delete_forever"
            >
                {text}
              </DropdownItem>
            </li>
          )}
        </PurgeUserButton>
      </DropdownMenu>
    </Dropdown>
  )
}

export default ActionsDropdown
