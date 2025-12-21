import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { getJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'
import getMeta from '@/utils/meta'

// Lazy load the export modal
const GoogleDriveExportModal = lazy(
  () => import('./google-drive-export-modal')
)

type LatestExport = {
  hasExport: boolean
  export?: {
    exportedAt: string
    fileName: string
    webViewLink: string
  }
}

const WARNING_DAYS = 7 // Show warning if not exported in this many days

export default function GoogleDriveExportWarning() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous')
  const googleDriveEnabled = getMeta('ol-googleDriveEnabled')

  // Skip if disabled or anonymous
  if (anonymous || !googleDriveEnabled) {
    return null
  }

  return <GoogleDriveExportWarningContent />
}

function GoogleDriveExportWarningContent() {
  const { t } = useTranslation()
  const { _id: projectId, name: projectName } = useProjectContext()

  const [latestExport, setLatestExport] = useState<LatestExport | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Check connection status and latest export on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        // First check if user is connected to Google Drive
        const statusResponse = await getJSON('/user/google-drive/status')
        const status = statusResponse as { connected: boolean }
        setIsConnected(status.connected)

        if (status.connected) {
          // Then check latest export
          const exportResponse = await getJSON(
            `/project/${projectId}/google-drive/latest-export`
          )
          setLatestExport(exportResponse as LatestExport)
        }
      } catch (error) {
        // Ignore errors - maybe user isn't connected
        setLatestExport({ hasExport: false })
      }
    }
    checkStatus()
  }, [projectId])

  // Check if export is stale
  const isExportStale = useCallback(() => {
    // Only warn if user is connected to Google Drive
    if (!isConnected) return false
    if (!latestExport) return false
    if (!latestExport.hasExport) return true

    const exportDate = new Date(latestExport.export!.exportedAt)
    const daysSinceExport =
      (Date.now() - exportDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceExport > WARNING_DAYS
  }, [latestExport, isConnected])

  // Handle beforeunload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isExportStale()) {
        event.preventDefault()
        // Note: Modern browsers don't show custom messages, but this still triggers the warning
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isExportStale])

  // Intercept navigation within the app
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href && !link.href.startsWith('javascript:')) {
        const url = new URL(link.href)

        // Only intercept internal navigation away from this project
        if (
          url.origin === window.location.origin &&
          !url.pathname.startsWith(`/project/${projectId}`) &&
          isExportStale()
        ) {
          event.preventDefault()
          setPendingNavigation(link.href)
          setShowWarning(true)
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [projectId, isExportStale])

  const handleContinue = useCallback(() => {
    setShowWarning(false)
    if (pendingNavigation) {
      window.location.href = pendingNavigation
    }
  }, [pendingNavigation])

  const handleExportFirst = useCallback(() => {
    setShowWarning(false)
    setShowExportModal(true)
  }, [])

  const handleExportComplete = useCallback(() => {
    setShowExportModal(false)
    // Refresh export status
    getJSON(`/project/${projectId}/google-drive/latest-export`)
      .then(response => setLatestExport(response as LatestExport))
      .catch(() => {})

    // Continue navigation if there was one pending
    if (pendingNavigation) {
      window.location.href = pendingNavigation
    }
  }, [projectId, pendingNavigation])

  return (
    <>
      {showWarning && (
        <OLModal show onHide={() => setShowWarning(false)}>
          <OLModalHeader closeButton>
            <OLModalTitle>
              {t('backup_reminder', { defaultValue: 'Backup Reminder' })}
            </OLModalTitle>
          </OLModalHeader>
          <OLModalBody>
            <OLNotification
              type="warning"
              content={
                latestExport?.hasExport
                  ? t('export_is_old', {
                      defaultValue:
                        'Your last Google Drive backup was more than a week ago. Would you like to export before leaving?',
                    })
                  : t('no_export_yet', {
                      defaultValue:
                        "This project hasn't been backed up to Google Drive yet. Would you like to export before leaving?",
                    })
              }
            />
            {latestExport?.hasExport && latestExport.export && (
              <p className="mt-3 text-muted small">
                Last exported:{' '}
                {new Date(latestExport.export.exportedAt).toLocaleString()}
              </p>
            )}
          </OLModalBody>
          <OLModalFooter>
            <OLButton variant="secondary" onClick={handleContinue}>
              {t('leave_anyway', { defaultValue: 'Leave Anyway' })}
            </OLButton>
            <OLButton variant="primary" onClick={handleExportFirst}>
              {t('export_first', { defaultValue: 'Export First' })}
            </OLButton>
          </OLModalFooter>
        </OLModal>
      )}

      <Suspense fallback={null}>
        {showExportModal && (
          <GoogleDriveExportModal
            projectId={projectId}
            projectName={projectName}
            onClose={handleExportComplete}
          />
        )}
      </Suspense>
    </>
  )
}
