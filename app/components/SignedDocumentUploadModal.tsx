'use client'

import { useState } from 'react'
import { uploadFileDirect } from '@/app/utils/uploadFile'

const baseUrl = 'https://epotos-ur-intel.vercel.app'

interface FileOption {
  id: string
  file_name: string
  type: 'version' | 'attachment'
  version_number?: number
}

interface Discrepancy {
  section: string
  type: string
  agreed_text: string
  signed_text: string
  severity: 'высокая' | 'средняя' | 'низкая'
}

interface CompareResult {
  match: boolean
  summary: string
  discrepancies: Discrepancy[]
}

interface Props {
  contractId: string
  userName: string
  userBitrixId: string
  fileOptions: FileOption[]
  onSuccess: () => void
  onClose: () => void
}

const severityColor: Record<string, string> = {
  высокая: 'bg-red-50 border-red-300 text-red-800',
  средняя: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  низкая: 'bg-blue-50 border-blue-200 text-blue-800',
}

const severityLabel: Record<string, string> = {
  высокая: '🔴 Высокая',
  средняя: '🟡 Средняя',
  низкая: '🔵 Низкая',
}

export default function SignedDocumentUploadModal({
  contractId, userName, userBitrixId, fileOptions, onSuccess, onClose
}: Props) {
  const [step, setStep] = useState<'select' | 'comparing' | 'result' | 'uploading'>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [compareFileId, setCompareFileId] = useState(fileOptions[0]?.id ?? '')
  const [compareFileType, setCompareFileType] = useState<'version' | 'attachment'>(fileOptions[0]?.type ?? 'version')
  const [signedDate, setSignedDate] = useState('')
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [discrepancyComment, setDiscrepancyComment] = useState('')
  const [error, setError] = useState('')
  const [tempFileUrl, setTempFileUrl] = useState('')
  const [tempFileName, setTempFileName] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setError('')
  }

  const handleCompare = async () => {
    if (!selectedFile) { setError('Выберите файл'); return }
    if (!compareFileId) { setError('Выберите документ для сравнения'); return }

    setStep('comparing')
    setError('')

    try {
      // Загружаем файл напрямую в Supabase минуя Vercel
      const { public_url, file_name } = await uploadFileDirect(
        selectedFile,
        'contracts',
        `temp/${contractId}`
      )

      setTempFileUrl(public_url)
      setTempFileName(file_name)

      // Запускаем AI сравнение
      const compareRes = await fetch(`${baseUrl}/api/ai-document-compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          signed_file_url: public_url,
          signed_file_name: selectedFile.name,
          compare_file_id: compareFileId,
          compare_file_type: compareFileType,
        }),
      })

      const compareData = await compareRes.json()
      if (compareData.error) { setError(compareData.error); setStep('select'); return }

      setCompareResult(compareData.result)
      setStep('result')
    } catch {
      setError('Ошибка при сравнении документов')
      setStep('select')
    }
  }

  const handleUpload = async (withDiscrepancies: boolean) => {
    if (withDiscrepancies && !discrepancyComment.trim()) {
      setError('Укажите причину загрузки документа с расхождениями')
      return
    }

    setStep('uploading')
    setError('')

    const fd = new FormData()
    fd.append('contract_id', contractId)
    fd.append('user_name', userName)
    fd.append('user_bitrix_id', userBitrixId)
    fd.append('confirm_upload', 'true')
    fd.append('temp_file_url', tempFileUrl)
    fd.append('temp_file_name', tempFileName)
    if (signedDate) fd.append('signed_date', signedDate)
    if (withDiscrepancies) {
      fd.append('has_discrepancies', 'true')
      fd.append('discrepancy_comment', discrepancyComment)
      fd.append('discrepancy_summary', compareResult?.summary ?? '')
    }

    const res = await fetch(`${baseUrl}/api/signed-documents`, { method: 'POST', body: fd })
    const data = await res.json()

    if (data.error) { setError(data.error); setStep('result'); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Загрузка подписанного документа</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* ШАГ 1 — ВЫБОР ФАЙЛА И ДОКУМЕНТА ДЛЯ СРАВНЕНИЯ */}
          {step === 'select' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Подписанный документ (PDF) <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 cursor-pointer hover:border-gray-400 transition-colors">
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {selectedFile ? selectedFile.name : 'Нажмите для выбора файла'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.docx"
                    onChange={handleFileSelect} />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сравнить с документом <span className="text-red-500">*</span>
                </label>
                {fileOptions.length === 0 ? (
                  <p className="text-sm text-gray-400">Нет загруженных версий для сравнения</p>
                ) : (
                  <select
                    value={compareFileId}
                    onChange={e => {
                      const opt = fileOptions.find(f => f.id === e.target.value)
                      setCompareFileId(e.target.value)
                      setCompareFileType(opt?.type ?? 'version')
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    {fileOptions.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.type === 'version' ? `📄 Версия ${f.version_number}` : '📎 Доп. материал'}: {f.file_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата подписания
                  <span className="ml-2 text-xs text-gray-400 font-normal">(необязательно)</span>
                </label>
                <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleCompare} disabled={!selectedFile || !compareFileId}
                  className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  🤖 Проверить через AI и загрузить
                </button>
                <button onClick={onClose}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </>
          )}

          {/* ШАГ 2 — СРАВНЕНИЕ */}
          {step === 'comparing' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl animate-pulse">🤖</div>
              <p className="text-sm font-medium text-gray-900">AI анализирует документы...</p>
              <p className="text-xs text-gray-400">Извлекаем текст и сравниваем содержимое. Это может занять 15-30 секунд.</p>
            </div>
          )}

          {/* ШАГ 3 — РЕЗУЛЬТАТ */}
          {step === 'result' && compareResult && (
            <>
              {/* Итог */}
              <div className={`rounded-xl border p-4 ${compareResult.match ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{compareResult.match ? '✅' : '⚠️'}</span>
                  <p className="text-sm font-semibold text-gray-900">
                    {compareResult.match ? 'Документы соответствуют друг другу' : 'Найдены расхождения'}
                  </p>
                </div>
                <p className="text-sm text-gray-600 ml-7">{compareResult.summary}</p>
              </div>

              {/* Список расхождений */}
              {compareResult.discrepancies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Найдено расхождений: {compareResult.discrepancies.length}
                  </h3>
                  {compareResult.discrepancies.map((d, i) => (
                    <div key={i} className={`rounded-lg border p-4 space-y-2 ${severityColor[d.severity] ?? 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{d.section}</p>
                        <span className="text-xs font-medium">{severityLabel[d.severity] ?? d.severity}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Согласованный</p>
                          <p className="text-xs text-gray-700">{d.agreed_text || '—'}</p>
                        </div>
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Подписанный</p>
                          <p className="text-xs text-gray-700">{d.signed_text || '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Комментарий при расхождениях */}
              {!compareResult.match && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Причина загрузки документа с расхождениями <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={discrepancyComment}
                    onChange={e => setDiscrepancyComment(e.target.value)}
                    placeholder="Объясните причину расхождений..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>
              )}

              {/* Кнопки */}
              <div className="flex gap-3 pt-2">
                {compareResult.match ? (
                  <button onClick={() => handleUpload(false)}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700">
                    ✅ Загрузить документ
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleUpload(true)}
                      disabled={!discrepancyComment.trim()}
                      className="flex-1 bg-yellow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50">
                      ⚠️ Загрузить с расхождениями
                    </button>
                    <button onClick={onClose}
                      className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      Отменить загрузку
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* ШАГ 4 — ЗАГРУЗКА */}
          {step === 'uploading' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl animate-pulse">📤</div>
              <p className="text-sm font-medium text-gray-900">Загружаем документ...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}