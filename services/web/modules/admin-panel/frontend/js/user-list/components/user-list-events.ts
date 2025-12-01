import { useCallback } from 'react'
import { sendMB } from '@/infrastructure/event-tracking'

export type ExtraSegmentations = {
  'menu-expand': {
    item: 'help' | 'account' | 'features' | 'admin'
    location: 'top-menu' | 'sidebar'
  }
  'menu-click': {
    item:
      | 'login'
      | 'register'
      | 'premium-features'
      | 'enterprises'
      | 'universities'
      | 'publishers'
      | 'edu'
      | 'government'
      | 'why-latex'
      | 'learn'
      | 'contact'
      | 'templates'
      | 'plans'
    location: 'top-menu' | 'sidebar'
    destinationURL?: string
  }
  'create-account-click': undefined
}

export const useSendUserListMB = () => {
  return useCallback(
    <T extends keyof ExtraSegmentations>(
      event: T,
      payload: ExtraSegmentations[T]
    ) => sendMB(event, payload),
    []
  )
}
