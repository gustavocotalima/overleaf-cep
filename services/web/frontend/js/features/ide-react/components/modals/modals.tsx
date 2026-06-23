import { lazy, memo, Suspense } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import ViewOnlyAccessModal from '@/features/share-project-modal/components/view-only-access-modal'
import ProjectConvertedFromDocumentModal from '@/features/ide-react/components/modals/project-converted-from-document-modal'

const GoogleDriveExportWarning = lazy(
  () =>
    import('@/features/google-drive/components/google-drive-export-warning')
)

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <ViewOnlyAccessModal />
      <ProjectConvertedFromDocumentModal />
      <Suspense fallback={null}>
        <GoogleDriveExportWarning />
      </Suspense>
    </>
  )
})
Modals.displayName = 'Modals'
