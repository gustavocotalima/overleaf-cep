import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getJSON } from '@/infrastructure/fetch-json'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'

type Folder = {
  id: string
  name: string
}

type PathItem = {
  id: string
  name: string
}

type Props = {
  onSelect: (folder: Folder) => void
  onCancel: () => void
}

export default function GoogleDriveFolderPicker({ onSelect, onCancel }: Props) {
  const { t } = useTranslation()

  const [currentFolderId, setCurrentFolderId] = useState('root')
  const [folders, setFolders] = useState<Folder[]>([])
  const [path, setPath] = useState<PathItem[]>([{ id: 'root', name: 'My Drive' }])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFolders() {
      setLoading(true)
      setError(null)

      try {
        const response = await getJSON(
          `/user/google-drive/folders?parentId=${currentFolderId}`
        )
        const data = response as { folders: Folder[]; path: PathItem[] }
        setFolders(data.folders || [])
        setPath(data.path || [{ id: 'root', name: 'My Drive' }])
      } catch (err: any) {
        setError(err.message || 'Failed to load folders')
      } finally {
        setLoading(false)
      }
    }

    loadFolders()
  }, [currentFolderId])

  const handleFolderClick = useCallback((folder: Folder) => {
    setCurrentFolderId(folder.id)
  }, [])

  const handlePathClick = useCallback((pathItem: PathItem) => {
    setCurrentFolderId(pathItem.id)
  }, [])

  const handleSelect = useCallback(() => {
    const currentFolder = path[path.length - 1]
    onSelect(currentFolder)
  }, [path, onSelect])

  return (
    <OLModal show onHide={onCancel} size="lg">
      <OLModalHeader closeButton>
        <OLModalTitle>
          {t('select_folder', { defaultValue: 'Select Folder' })}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {/* Breadcrumb path */}
        <nav aria-label="breadcrumb" className="mb-3">
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

        {/* Folder list */}
        <div
          className="border rounded"
          style={{ minHeight: '300px', maxHeight: '400px', overflowY: 'auto' }}
        >
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100 p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-danger p-3">{error}</div>
          ) : folders.length === 0 ? (
            <div className="text-muted p-3 text-center">
              {t('no_folders', { defaultValue: 'No folders in this location' })}
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {folders.map(folder => (
                <li
                  key={folder.id}
                  className="list-group-item list-group-item-action d-flex align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleFolderClick(folder)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleFolderClick(folder)
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <MaterialIcon type="folder" className="me-2 text-warning" />
                  {folder.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-muted mt-2 small">
          {t('current_selection', { defaultValue: 'Current selection' })}:{' '}
          <strong>{path[path.length - 1]?.name || 'My Drive'}</strong>
        </p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="primary" onClick={handleSelect}>
          {t('select_this_folder', { defaultValue: 'Select This Folder' })}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
