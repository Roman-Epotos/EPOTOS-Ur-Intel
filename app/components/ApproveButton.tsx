'use client'

import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Props {
  contractId: string
  contractStatus: string
  authorBitrixId: number | null
}

export default function ApproveButton({ contractId, contractStatus, authorBitrixId }: Props) {
  const { user } = useBitrixAuth()

  const adminIds = [30, 1148]
  const isAdmin = user ? adminIds.includes(parseInt(user.id)) : false
  const isAuthor = user ? parseInt(user.id) === authorBitrixId : false

  if (contractStatus !== 'черновик') return null
  if (!isAdmin && !isAuthor) return null

  return (
    <Link
      href={`/contracts/${contractId}/approve`}
      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
    >
      Отправить на согласование
    </Link>
  )
}