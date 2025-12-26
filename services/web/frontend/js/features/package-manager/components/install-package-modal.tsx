import { useState, useCallback, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import { OLModal } from '@/shared/components/ol/ol-modal'
import {
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

type InstallPackageModalProps = {
  isOpen: boolean
  handleClose: () => void
}

type InstallResult = {
  success: boolean
  message?: string
  error?: string
  output?: string
}

export default function InstallPackageModal({
  isOpen,
  handleClose,
}: InstallPackageModalProps) {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  const [packageName, setPackageName] = useState('')
  const [inFlight, setInFlight] = useState(false)
  const [result, setResult] = useState<InstallResult | null>(null)

  const handleHide = useCallback(() => {
    if (!inFlight) {
      handleClose()
      // Reset state when closing
      setPackageName('')
      setResult(null)
    }
  }, [handleClose, inFlight])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()

      if (!packageName.trim()) {
        return
      }

      // Validate package name
      if (!/^[a-zA-Z0-9_-]+$/.test(packageName)) {
        setResult({
          success: false,
          error: 'Invalid package name. Only letters, numbers, hyphens, and underscores are allowed.',
        })
        return
      }

      setInFlight(true)
      setResult(null)

      try {
        const response = await postJSON<InstallResult>(
          `/project/${projectId}/package/install`,
          {
            body: { packageName: packageName.trim() },
          }
        )

        setResult({
          success: true,
          message: response.message || `Package '${packageName}' installed successfully`,
        })
        setPackageName('')
      } catch (error: any) {
        const errorMessage =
          error?.data?.error ||
          error?.message ||
          'Failed to install package'
        setResult({
          success: false,
          error: errorMessage,
        })
      } finally {
        setInFlight(false)
      }
    },
    [packageName, projectId]
  )

  return (
    <OLModal
      animation
      show={isOpen}
      onHide={handleHide}
      id="install-package-modal"
    >
      <OLModalHeader>
        <OLModalTitle>Install LaTeX Package</OLModalTitle>
      </OLModalHeader>

      <form onSubmit={handleSubmit}>
        <OLModalBody>
          <p className="mb-3">
            Install missing LaTeX packages from TeX Live. Enter the package name
            (e.g., <code>biblatex-ieee</code>, <code>simpleicons</code>).
          </p>

          {result && (
            <OLNotification
              type={result.success ? 'success' : 'error'}
              content={result.success ? result.message : result.error}
              className="mb-3"
            />
          )}

          <OLFormGroup controlId="package-name">
            <OLFormLabel>Package Name</OLFormLabel>
            <OLFormControl
              type="text"
              value={packageName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPackageName(e.target.value)
              }
              placeholder="e.g., biblatex-ieee"
              disabled={inFlight}
              autoFocus
            />
          </OLFormGroup>

          <p className="small text-muted mt-2">
            After installation, click &quot;Recompile&quot; to use the new package.
            Common packages: <code>biber</code>, <code>biblatex-ieee</code>,{' '}
            <code>simpleicons</code>, <code>fontawesome5</code>
          </p>
        </OLModalBody>

        <OLModalFooter>
          <OLButton
            variant="secondary"
            disabled={inFlight}
            onClick={handleHide}
          >
            {t('close')}
          </OLButton>
          <OLButton
            type="submit"
            variant="primary"
            disabled={inFlight || !packageName.trim()}
          >
            {inFlight ? 'Installing...' : 'Install Package'}
          </OLButton>
        </OLModalFooter>
      </form>
    </OLModal>
  )
}
