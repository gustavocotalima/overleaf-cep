import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON, getJSON } from '@/infrastructure/fetch-json'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol-modal'
import OLButton from '@/features/ui/components/ol-button'
import OLFormGroup from '@/features/ui/components/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol-form-label'
import OLFormControl from '@/features/ui/components/ol-form-control'
import OLNotification from '@/features/ui/components/ol-notification'
import MaterialIcon from '@/shared/components/material-icon'

type DriveFile = {
  id: string
  name: string
  size: number
  modifiedTime: string
}

type Props = {
  onClose: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

export default function GoogleDriveImportModal({ onClose }: Props) {
  const { t } = useTranslation()

  const [files, setFiles] = useState<DriveFile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    projectId: string
    projectName: string
  } | null>(null)

  useEffect(() => {
    async function loadFiles() {
      setLoading(true)
      setError(null)

      try {
        const params = searchQuery
          ? `?search=${encodeURIComponent(searchQuery)}`
          : ''
        const response = await getJSON(`/user/google-drive/files${params}`)
        const data = response as { files: DriveFile[] }
        setFiles(data.files || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load files')
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(loadFiles, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleFileSelect = useCallback((file: DriveFile) => {
    setSelectedFile(file)
    // Set default project name from filename (without .zip)
    setProjectName(file.name.replace(/\.zip$/i, ''))
  }, [])

  const handleImport = useCallback(async () => {
    if (!selectedFile) return

    setImporting(true)
    setError(null)

    try {
      const response = await postJSON('/project/google-drive/import', {
        body: {
          fileId: selectedFile.id,
          projectName: projectName || selectedFile.name.replace(/\.zip$/i, ''),
        },
      })

      setResult(response as { projectId: string; projectName: string })
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [selectedFile, projectName])

  if (result) {
    return (
      <OLModal show onHide={onClose}>
        <OLModalHeader closeButton>
          <OLModalTitle>
            {t('import_successful', { defaultValue: 'Import Successful' })}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <OLNotification
            type="success"
            content={`Project "${result.projectName}" has been imported successfully.`}
          />
        </OLModalBody>
        <OLModalFooter>
          <OLButton variant="secondary" onClick={onClose}>
            {t('close')}
          </OLButton>
          <OLButton
            variant="primary"
            onClick={() => {
              window.location.href = `/project/${result.projectId}`
            }}
          >
            {t('open_project', { defaultValue: 'Open Project' })}
          </OLButton>
        </OLModalFooter>
      </OLModal>
    )
  }

  return (
    <OLModal show onHide={onClose} size="lg">
      <OLModalHeader closeButton>
        <OLModalTitle>
          {t('import_from_google_drive', {
            defaultValue: 'Import from Google Drive',
          })}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {error && (
          <OLNotification type="error" content={error} className="mb-3" />
        )}

        {/* Search */}
        <OLFormGroup>
          <OLFormControl
            type="text"
            placeholder={t('search_zip_files', {
              defaultValue: 'Search ZIP files...',
            })}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
          />
        </OLFormGroup>

        {/* File list */}
        <div
          className="border rounded mb-3"
          style={{ minHeight: '250px', maxHeight: '350px', overflowY: 'auto' }}
        >
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100 p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-muted p-3 text-center">
              {searchQuery
                ? t('no_matching_files', {
                    defaultValue: 'No matching ZIP files found',
                  })
                : t('no_zip_files', {
                    defaultValue: 'No ZIP files found in your Google Drive',
                  })}
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {files.map(file => (
                <li
                  key={file.id}
                  className={`list-group-item list-group-item-action d-flex align-items-center ${
                    selectedFile?.id === file.id ? 'active' : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleFileSelect(file)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleFileSelect(file)
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <MaterialIcon type="folder_zip" className="me-2" />
                  <div className="flex-grow-1">
                    <div>{file.name}</div>
                    <small
                      className={
                        selectedFile?.id === file.id
                          ? 'text-light'
                          : 'text-muted'
                      }
                    >
                      {formatFileSize(file.size)} • {formatDate(file.modifiedTime)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Project name input (shown when file is selected) */}
        {selectedFile && (
          <OLFormGroup>
            <OLFormLabel htmlFor="projectName">
              {t('project_name', { defaultValue: 'Project Name' })}
            </OLFormLabel>
            <OLFormControl
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProjectName(e.target.value)
              }
              disabled={importing}
            />
          </OLFormGroup>
        )}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onClose} disabled={importing}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={handleImport}
          disabled={!selectedFile || importing}
          isLoading={importing}
        >
          {importing
            ? t('importing', { defaultValue: 'Importing...' })
            : t('import', { defaultValue: 'Import' })}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
