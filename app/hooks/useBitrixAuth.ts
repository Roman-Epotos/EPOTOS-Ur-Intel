'use client'

import { useAuthContext } from '@/app/providers/AuthProvider'
export type { BitrixUser } from '@/app/providers/AuthProvider'

export function useBitrixAuth() {
  return useAuthContext()
}