import { ReactNode, useEffect } from 'react'
import {
  UserListProvider,
  useUserListContext,
} from '../context/user-list-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import LoadingBranded from '@/shared/components/loading-branded'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import { UserListDsNav } from './user-list-ds-nav'
import { DsNavStyleProvider } from '@/features/project-list/components/use-is-ds-nav'

function UserListRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <UserListRootInner />
}

export function UserListRootInner() {
  return (
    <UserListProvider>
      <UserListPageContent />
    </UserListProvider>
  )
}

function UserListPageContent() {
  const { isLoading, loadProgress } = useUserListContext()

  useEffect(() => {
    eventTracking.sendMB('loads_v2_dash', {})
  }, [])

  const { t } = useTranslation()

  if (isLoading) {
    const loadingComponent = (
      <LoadingBranded loadProgress={loadProgress} label={t('loading')} />
    )

    return loadingComponent
  }

  return (
    <DsNavStyleProvider>
      <UserListDsNav />
    </DsNavStyleProvider>
  )
}

export default withErrorBoundary(UserListRoot, () => (
  <GenericErrorBoundaryFallback />
))
