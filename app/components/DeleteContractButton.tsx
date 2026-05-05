'use client'

import { useState } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Props {
  contractId: string
  contractNumber: string
}

export default function DeleteContractButton({ contractId, contractNumber }: Props) {
  const { user } = useBitrixAuth()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const adminIds = [30, 1148]
  const isAdmin = user ? adminIds.includes(parseInt(user.id)) : false

  if (!isAdmin) return null

  const handleDelete = async () => {
    setDeleting(true)
    setError('')

    try {
      const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const response = await fetch(`${baseUrl}/api/contracts/${contractId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_bitrix_id: parseInt(user?.id ?? '0'),
          user_name: user?.name ?? 'Администратор',
          reason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Ошибка удаления')
        setDeleting(false)
        return
      }

      window.location.href = '/'
    } catch {
      setError('Ошибка соединения')
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
      >
        Удалить документ
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Удаление договора</h3>
            <p className="text-sm text-gray-600 mb-4">
              Вы собираетесь Удалить документ <strong>{contractNumber}</strong>. Это действие необратимо — все версии, история и данные согласования будут удалены.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Причина удаления
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Укажите причину удаления..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : 'Удалить документ'}
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