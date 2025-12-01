import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/api'

type EmailCellProps = {
  user: User
}

export default function EmailCell({ user }: EmailCellProps) {
  return (
      <span translate="no">{user.email}</span>
  )
}
