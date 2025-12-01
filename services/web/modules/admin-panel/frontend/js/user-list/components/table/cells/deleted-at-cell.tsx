import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { formatDate, fromNowDate } from '@/utils/dates'
import { User } from '../../../../../../types/api'

type DeletedAtProps = {
  user: User
}

export default function deletedAtCell({ user }: deletedAtCellProps) {
  const deletedAtDate = user.deletedAt ? fromNowDate(user.deletedAt) : 'not deleted'
  const tooltipText = user.deletedAt ? formatDate(user.deletedAt) : 'not deleted'
  return (
    <OLTooltip
      key={`tooltip-deleted-at-${user.id}`}
      id={`tooltip-deleted-at-${user.id}`}
      description={tooltipText}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <span>{deletedAtDate}</span>
    </OLTooltip>
  )
}
