import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON, getJSON } from '@/infrastructure/fetch-json'
import {
  OLModal,
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
import MaterialIcon from '@/shared/components/material-icon'

type DriveFile = {
  id: string
  name: string
  size: number
  modifiedTime: string
}

type DriveFolder = {
  id: string
  name: string
}

type PathItem = {
  id: string
  name: string
}

type ImportMode = 'current' | 'new'

type Props = {
  onClose: () => void
  projectId?: string
  projectName?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

export default function GoogleDriveImportModal({
  onClose,
  projectId,
  projectName: currentProjectName,
}: Props) {
  const { t } = useTranslation()

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState('root')
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [path, setPath] = useState<PathItem[]>([
    { id: 'root', name: 'My Drive' },
  ])

  // File state
  const [files, setFiles] = useState<DriveFile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [newProjectName, setNewProjectName] = useState('')

  // Import mode
  const [importMode, setImportMode] = useState<ImportMode>(
    projectId ? 'current' : 'new'
  )

  // UI state
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    projectId: string
    projectName: string
  } | null>(null)

  const isSearching = searchQuery.trim().length > 0

  // Fetch folders and files
  useEffect(() => {
    async function loadContent() {
      setLoading(true)
      setError(null)

      try {
        if (isSearching) {
          // Search mode: flat file list
          const response = await getJSON(
            `/user/google-drive/files?search=${encodeURIComponent(searchQuery)}`
          )
          const data = response as { files: DriveFile[] }
          setFiles(data.files || [])
          setFolders([])
        } else {
          // Browse mode: folders + files in current folder
          const [foldersRes, filesRes] = await Promise.all([
            getJSON(
              `/user/google-drive/folders?parentId=${currentFolderId}`
            ),
            getJSON(
              `/user/google-drive/files?folderId=${currentFolderId}`
            ),
          ])
          const fData = foldersRes as {
            folders: DriveFolder[]
            path: PathItem[]
          }
          const fileData = filesRes as { files: DriveFile[] }
          setFolders(fData.folders || [])
          setPath(fData.path || [{ id: 'root', name: 'My Drive' }])
          setFiles(fileData.files || [])
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load files')
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(loadContent, isSearching ? 300 : 0)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, currentFolderId, isSearching])

  const handleFolderClick = useCallback((folder: DriveFolder) => {
    setCurrentFolderId(folder.id)
    setSearchQuery('')
  }, [])

  const handlePathClick = useCallback((pathItem: PathItem) => {
    setCurrentFolderId(pathItem.id)
    setSearchQuery('')
  }, [])

  const handleFileSelect = useCallback((file: DriveFile) => {
    setSelectedFile(file)
    setNewProjectName(file.name.replace(/\.zip$/i, ''))
  }, [])

  const handleImport = useCallback(async () => {
    if (!selectedFile) return

    setImporting(true)
    setError(null)

    try {
      if (importMode === 'current' && projectId) {
        const response = await postJSON(
          `/project/${projectId}/google-drive/import`,
          { body: { fileId: selectedFile.id } }
        )
        setResult(response as { projectId: string; projectName: string })
      } else {
        const response = await postJSON('/project/google-drive/import', {
          body: {
            fileId: selectedFile.id,
            projectName:
              newProjectName || selectedFile.name.replace(/\.zip$/i, ''),
          },
        })
        setResult(response as { projectId: string; projectName: string })
      }
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [selectedFile, newProjectName, importMode, projectId])

  // Success view
  if (result) {
    const isCurrentProject = importMode === 'current'
    if (isCurrentProject) {
      // Overleaf auto-updates the editor, just close the modal
      onClose()
      return null
    }
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

        {/* Breadcrumb navigation */}
        {!isSearching && (
          <nav aria-label="breadcrumb" className="mb-2">
            <ol className="breadcrumb">
              {path.map((item, index) => (
                <li
                  key={item.id}
                  className={`breadcrumb-item ${
                    index === path.length - 1 ? 'active' : ''
                  }`}
                >
                  {index === path.length - 1 ? (
                    item.name
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link p-0"
                      onClick={() => handlePathClick(item)}
                    >
                      {item.name}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Search */}
        <OLFormGroup className="mb-2">
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

        {/* Folder + file list */}
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
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="text-muted p-3 text-center">
              {isSearching
                ? t('no_matching_files', {
                    defaultValue: 'No matching ZIP files found',
                  })
                : t('no_files_here', {
                    defaultValue: 'No folders or ZIP files here',
                  })}
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {/* Folders */}
              {folders.map(folder => (
                <li
                  key={`folder-${folder.id}`}
                  className="list-group-item list-group-item-action d-flex align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleFolderClick(folder)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleFolderClick(folder)
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <MaterialIcon
                    type="folder"
                    className="me-2 text-warning"
                  />
                  <div className="flex-grow-1">{folder.name}</div>
                </li>
              ))}
              {/* Files */}
              {files.map(file => (
                <li
                  key={`file-${file.id}`}
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
                      {formatFileSize(file.size)} •{' '}
                      {formatDate(file.modifiedTime)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Import mode selection */}
        {selectedFile && projectId && (
          <OLFormGroup className="mb-3">
            <OLFormLabel>
              {t('import_mode', { defaultValue: 'Import mode' })}
            </OLFormLabel>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="importMode"
                id="import-mode-current"
                checked={importMode === 'current'}
                onChange={() => setImportMode('current')}
              />
              <label
                className="form-check-label"
                htmlFor="import-mode-current"
              >
                Replace files in current project ({currentProjectName})
              </label>
              <div className="form-text text-warning">
                This will replace all matching files in the current project
                with contents from the ZIP.
              </div>
            </div>
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="radio"
                name="importMode"
                id="import-mode-new"
                checked={importMode === 'new'}
                onChange={() => setImportMode('new')}
              />
              <label className="form-check-label" htmlFor="import-mode-new">
                Create new project
              </label>
            </div>
          </OLFormGroup>
        )}

        {/* Project name (only for new project mode) */}
        {selectedFile && importMode === 'new' && (
          <OLFormGroup>
            <OLFormLabel htmlFor="projectName">
              {t('project_name', { defaultValue: 'Project name' })}
            </OLFormLabel>
            <OLFormControl
              id="projectName"
              type="text"
              value={newProjectName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewProjectName(e.target.value)
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
            : importMode === 'current'
              ? t('replace_files', { defaultValue: 'Replace Files' })
              : t('import', { defaultValue: 'Import' })}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
