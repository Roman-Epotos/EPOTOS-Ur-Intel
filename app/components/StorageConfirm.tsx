'use client'

import { useState } from 'react'

const baseUrl = 'https://epotos-ur-intel.vercel.app'

interface Props {
  contractId: string
  contractStatus: string
  storageConfirmedAt: string | null
  storageConfirmedByName: string | null
  userName?: string
  userId?: number
}

export default function StorageConfirm({
  contractId,
  contractStatus,
  storageConfirmedAt,
  storageConfirmedByName,
  userName,
  userId,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmedAt, setConfirmedAt] = useState(storageConfirmedAt)
  const [confirmedByName, setConfirmedByName] = useState(storageConfirmedByName)

  const isSignedOrLater = ['подписан', 'на_исполнении'].includes(contractStatus)

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${baseUrl}/api/contracts/${contractId}/storage-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName ?? 'Система', user_bitrix_id: userId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Ошибка сохранения')
        return
      }
      setConfirmedAt(new Date().toISOString())
      setConfirmedByName(userName ?? 'Система')
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Отменить отметку о приёме на хранение?')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${baseUrl}/api/contracts/${contractId}/storage-confirm?user_bitrix_id=${userId ?? ''}&user_name=${encodeURIComponent(userName ?? '')}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Ошибка отмены')
        return
      }
      setConfirmedAt(null)
      setConfirmedByName(null)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  if (!isSignedOrLater) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        📦 Приём на хранение станет доступен после того, как документ будет подписан
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">📦 Хранение оригинала</h2>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {confirmedAt ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">✅ Оригинал принят на хранение</p>
          <p className="text-xs text-green-700 mt-1">
            {confirmedByName} · {new Date(confirmedAt).toLocaleString('ru-RU')}
          </p>
          <button onClick={handleCancel} disabled={loading}
            className="mt-3 text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
            Отменить отметку
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-600 mb-3">
            Отметьте, когда оригинал подписанного документа физически принят на хранение в юридический отдел.
          </p>
          <button onClick={handleConfirm} disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Сохранение...' : '✅ Принять на хранение'}
          </button>
        </div>
      )}
    </div>
  )
}