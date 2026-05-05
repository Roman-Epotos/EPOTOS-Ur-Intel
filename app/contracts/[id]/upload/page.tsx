'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

export default function UploadVersionPage() {
  const params = useParams()
  const contractId = params.id as string
  const { user } = useBitrixAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (!allowed.includes(selected.type)) {
      setError('Допустимые форматы: PDF, DOC, DOCX')
      return
    }

    if (selected.size > 20 * 1024 * 1024) {
      setError('Файл не должен превышать 20 МБ')
      return
    }

    setFile(selected)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Выберите файл'); return }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('contract_id', contractId)
      formData.append('comment', comment)
      formData.append('user_name', user?.name ?? 'Система')

      const response = await fetch('https://epotos-ur-intel.vercel.app/api/versions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError('Ошибка загрузки файла: ' + (data.error ?? 'Неизвестная ошибка'))
        setLoading(false)
        return
      }

      window.location.href = `https://epotos-ur-intel.vercel.app/contracts/${contractId}`
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setError('Ошибка: ' + message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href={`/contracts/${contractId}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Назад
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Загрузить версию документа</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Файл договора <span className="text-red-500">*</span>
              </label>
              <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} МБ
                    </p>
                    <button type="button" onClick={() => setFile(null)}
                      className="mt-2 text-xs text-red-500 hover:text-red-700 underline">
                      Удалить
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Нажмите для выбора файла</p>
                    <p className="text-xs text-gray-400">PDF, DOCX, XLSX — до 20 МБ</p>
                  </div>
                )}
                {!file && (
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Комментарий к версии
              </label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: первичная версия, правки юриста..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading || !file}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {loading ? 'Загрузка...' : 'Загрузить документ'}
              </button>
              <Link href={`/contracts/${contractId}`}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Отмена
              </Link>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}