import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import LeftMenuButton from './left-menu-button'
import { getJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import getMeta from '@/utils/meta'

// Lazy load modals
const GoogleDriveExportModal = lazy(
  () => import('@/features/google-drive/components/google-drive-export-modal')
)
const GoogleDriveImportModal = lazy(
  () => import('@/features/google-drive/components/google-drive-import-modal')
)

type ConnectionStatus = {
  connected: boolean
  email?: string
}

export default function GoogleDriveMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous')
  const googleDriveEnabled = getMeta('ol-googleDriveEnabled')

  // Skip if disabled or anonymous
  if (anonymous || !googleDriveEnabled) {
    return null
  }

  return <GoogleDriveMenuContent />
}

function GoogleDriveMenuContent() {
  const { t } = useTranslation()
  const { _id: projectId, name: projectName } = useProjectContext()

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkConnection() {
      try {
        const status = await getJSON('/user/google-drive/status')
        setConnectionStatus(status as ConnectionStatus)
      } catch (error) {
        console.error('Failed to check Google Drive connection:', error)
        setConnectionStatus({ connected: false })
      } finally {
        setLoading(false)
      }
    }
    checkConnection()
  }, [])

  const handleExportClick = useCallback(() => {
    if (!connectionStatus?.connected) {
      // Redirect to connect, then come back
      const returnTo = encodeURIComponent(window.location.pathname + '?open-export=true')
      window.location.href = `/user/google-drive/connect?returnTo=${returnTo}`
      return
    }
    setShowExportModal(true)
  }, [connectionStatus])

  const handleImportClick = useCallback(() => {
    if (!connectionStatus?.connected) {
      const returnTo = encodeURIComponent(window.location.pathname + '?open-import=true')
      window.location.href = `/user/google-drive/connect?returnTo=${returnTo}`
      return
    }
    setShowImportModal(true)
  }, [connectionStatus])

  // Check URL params for auto-opening modals after OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('open-export') === 'true' && connectionStatus?.connected) {
      setShowExportModal(true)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('open-import') === 'true' && connectionStatus?.connected) {
      setShowImportModal(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [connectionStatus])

  if (loading) {
    return null
  }

  return (
    <>
      <h4>Google Drive</h4>
      <ul className="list-unstyled nav">
        <li>
          <LeftMenuButton onClick={handleExportClick} icon="cloud_upload">
            {t('export_to_google_drive', { defaultValue: 'Export to Drive' })}
          </LeftMenuButton>
        </li>
        <li>
          <LeftMenuButton onClick={handleImportClick} icon="cloud_download">
            {t('import_from_google_drive', { defaultValue: 'Import from Drive' })}
          </LeftMenuButton>
        </li>
        {connectionStatus?.connected && (
          <li className="text-muted small" style={{ padding: '4px 15px', fontSize: '11px' }}>
            {connectionStatus.email}
          </li>
        )}
      </ul>

      <Suspense fallback={null}>
        {showExportModal && (
          <GoogleDriveExportModal
            projectId={projectId}
            projectName={projectName}
            onClose={() => setShowExportModal(false)}
          />
        )}

        {showImportModal && (
          <GoogleDriveImportModal onClose={() => setShowImportModal(false)} />
        )}
      </Suspense>
    </>
  )
}
