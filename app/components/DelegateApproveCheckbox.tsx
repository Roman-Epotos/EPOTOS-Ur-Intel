'use client'

import { useState } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Props {
  contractId: string
  contractNumber: string
  authorBitrixId: number | null
  allowOthers: boolean
}

export default function DelegateApproveCheckbox({
  contractId,
  contractNumber,
  authorBitrixId,
  allowOthers,
}: Props) {
  const { user } = useBitrixAuth()
  const [checked, setChecked] = useState(allowOthers)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const adminIds = [30, 1148]
  const isAdmin = user ? adminIds.includes(parseInt(user.id)) : false
  const isAuthor = user ? parseInt(user.id) === authorBitrixId : false

  if (!isAdmin && !isAuthor) return null

  const handleChange = () => {
    setShowModal(true)
  }

  const handleConfirm = async () => {
    setSaving(true)
    const newValue = !checked

    try {
      await fetch(`https://epotos-ur-intel.vercel.app/api/contracts/${contractId}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allow_others_to_approve: newValue,
          user_name: user?.name ?? 'Система',
          user_bitrix_id: user?.id ? parseInt(user.id) : null,
        }),
      })
      setChecked(newValue)
    } catch {
      console.error('Ошибка сохранения')
    }

    setSaving(false)
    setShowModal(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3">
        <input
          type="checkbox"
          id="delegate-approve"
          checked={checked}
          onChange={handleChange}
          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
        />
        <label htmlFor="delegate-approve" className="text-xs text-gray-600 cursor-pointer">
          Разрешить другим сотрудникам запускать согласование
        </label>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение</h3>
            <p className="text-sm text-gray-600 mb-6">
              {checked
                ? `Вы собираетесь запретить другим сотрудникам запускать согласование по договору ${contractNumber}. Только вы и администраторы сможете отправить его на согласование.`
                : `Вы собираетесь разрешить другим сотрудникам запускать согласование по договору ${contractNumber}. Любой сотрудник системы сможет отправить его на согласование.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Подтвердить'}
              </button>
              <button
                onClick={() => setShowModal(false)}
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