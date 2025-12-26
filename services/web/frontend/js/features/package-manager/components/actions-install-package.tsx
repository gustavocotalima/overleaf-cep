import { useState, useCallback } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import InstallPackageModal from './install-package-modal'

export default function ActionsInstallPackage() {
  const [showModal, setShowModal] = useState(false)

  const handleClick = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowModal(false)
  }, [])

  return (
    <>
      <OLButton
        variant="link"
        onClick={handleClick}
        className="left-menu-button"
      >
        <MaterialIcon type="download" />
        <span className="ms-1">Install Package</span>
      </OLButton>
      <InstallPackageModal isOpen={showModal} handleClose={handleClose} />
    </>
  )
}
