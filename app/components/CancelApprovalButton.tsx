'use client'

import { useState } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Props {
  sessionId: string
  contractId: string
  contractNumber: string
  initiatedByBitrixId: number | null
  onCancelled: () => void
}

export default function CancelApprovalButton({
  sessionId,
  contractId,
  contractNumber,
  initiatedByBitrixId,
  onCancelled,
}: Props) {
  const { user } = useBitrixAuth()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const adminIds = [30, 1148]
  const isAdmin = user ? adminIds.includes(parseInt(user.id)) : false
  const isInitiator = user ? parseInt(user.id) === initiatedByBitrixId : false

  if (!isAdmin && !isInitiator) return null

  const handleCancel = async () => {
    if (!reason.trim()) {
      setError('Укажите причину прерывания')
      return
    }

    setCancelling(true)
    setError('')

    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/approvals/${sessionId}/approve`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          user_name: user?.name ?? 'Система',
          contract_id: contractId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Ошибка прерывания')
        setCancelling(false)
        return
      }

      setShowModal(false)
      onCancelled()
    } catch {
      setError('Ошибка соединения')
      setCancelling(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
      >
        Прервать согласование
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Прерывание согласования</h3>
            <p className="text-sm text-gray-600 mb-4">
              Согласование по договору <strong>{contractNumber}</strong> будет прервано.
              Договор перейдёт в статус <strong>Архив</strong>.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Причина прерывания <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Например: отказ от сделки, изменились условия..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Прерывание...' : 'Прервать согласование'}
              </button>
              <button
                onClick={() => { setShowModal(false); setReason(''); setError('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}