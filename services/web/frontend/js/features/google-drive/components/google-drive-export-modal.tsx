import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON, getJSON } from '@/infrastructure/fetch-json'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLNotification from '@/shared/components/ol/ol-notification'
import GoogleDriveFolderPicker from './google-drive-folder-picker'

type Props = {
  projectId: string
  projectName: string
  onClose: () => void
}

type ExportResult = {
  success: boolean
  fileId?: string
  fileName?: string
  webViewLink?: string
  error?: string
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200)
}

export default function GoogleDriveExportModal({
  projectId,
  projectName,
  onClose,
}: Props) {
  const { t } = useTranslation()

  const defaultFileName = `${sanitizeFileName(projectName)}-${formatDate(new Date())}.zip`

  const [fileName, setFileName] = useState(defaultFileName)
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string }>({
    id: 'root',
    name: 'My Drive',
  })
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    setExporting(true)
    setError(null)

    try {
      const response = await postJSON(`/project/${projectId}/google-drive/export`, {
        body: {
          folderId: selectedFolder.id,
          fileName: fileName.endsWith('.zip') ? fileName : `${fileName}.zip`,
        },
      })

      setResult(response as ExportResult)
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }, [projectId, selectedFolder, fileName])

  const handleFolderSelect = useCallback((folder: { id: string; name: string }) => {
    setSelectedFolder(folder)
    setShowFolderPicker(false)
  }, [])

  if (showFolderPicker) {
    return (
      <GoogleDriveFolderPicker
        onSelect={handleFolderSelect}
        onCancel={() => setShowFolderPicker(false)}
      />
    )
  }

  if (result?.success) {
    return (
      <OLModal show onHide={onClose}>
        <OLModalHeader closeButton>
          <OLModalTitle>
            {t('export_successful', { defaultValue: 'Export Successful' })}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <OLNotification
            type="success"
            content={
              <>
                Your project has been exported to Google Drive.
                <br />
                <a
                  href={result.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Drive
                </a>
              </>
            }
          />
          <p className="mt-3">
            <strong>File:</strong> {result.fileName}
          </p>
        </OLModalBody>
        <OLModalFooter>
          <OLButton variant="secondary" onClick={onClose}>
            {t('close')}
          </OLButton>
        </OLModalFooter>
      </OLModal>
    )
  }

  return (
    <OLModal show onHide={onClose}>
      <OLModalHeader closeButton>
        <OLModalTitle>
          {t('export_to_google_drive', { defaultValue: 'Export to Google Drive' })}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {error && <OLNotification type="error" content={error} className="mb-3" />}

        <OLFormGroup>
          <OLFormLabel htmlFor="fileName">
            {t('file_name', { defaultValue: 'File Name' })}
          </OLFormLabel>
          <OLFormControl
            id="fileName"
            type="text"
            value={fileName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFileName(e.target.value)
            }
            disabled={exporting}
          />
        </OLFormGroup>

        <OLFormGroup>
          <OLFormLabel>
            {t('destination_folder', { defaultValue: 'Destination Folder' })}
          </OLFormLabel>
          <div className="d-flex align-items-center gap-2">
            <OLFormControl
              type="text"
              value={selectedFolder.name}
              readOnly
              style={{ flex: 1 }}
            />
            <OLButton
              variant="secondary"
              onClick={() => setShowFolderPicker(true)}
              disabled={exporting}
            >
              {t('browse', { defaultValue: 'Browse' })}
            </OLButton>
          </div>
        </OLFormGroup>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onClose} disabled={exporting}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={handleExport}
          disabled={exporting || !fileName.trim()}
          isLoading={exporting}
        >
          {exporting
            ? t('exporting', { defaultValue: 'Exporting...' })
            : t('export', { defaultValue: 'Export' })}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
