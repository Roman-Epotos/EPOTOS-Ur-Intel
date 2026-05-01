'use client'

import { useState, useEffect } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface RedFlag {
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
}

interface LegalReview {
  red_flags: RedFlag[]
  warnings: { title: string; description: string }[]
  positives: { title: string; description: string }[]
  overall_risk: 'high' | 'medium' | 'low'
  summary: string
}

interface Passport {
  essence: string
  parties: {
    our_obligations: string[]
    counterparty_obligations: string[]
  }
  key_terms: {
    amount: string
    payment_terms: string
    start_date: string
    end_date: string
    auto_renewal: string
  }
  termination: string
  control_points: string[]
  attention_zones: string[]
}

interface Analysis {
  id: string
  type: string
  status: string
  result_json: LegalReview | Passport | { error: string } | null
  created_at: string
  model_used: string
}

interface Version {
  id: string
  file_url: string
  file_name: string
  version_number: number
}

interface Props {
  contractId: string
  versions: Version[]
}

const RISK_COLORS = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
}

const RISK_ICONS = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
}

const RISK_LABELS = {
  high: 'Высокий риск',
  medium: 'Средний риск',
  low: 'Низкий риск',
}

export default function AIAnalysis({ contractId, versions }: Props) {
  const { user } = useBitrixAuth()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'legal_review' | 'passport'>('legal_review')
  const [selectedVersion, setSelectedVersion] = useState<string>('')

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    if (versions.length > 0) {
      setSelectedVersion(versions[0].id)
    }
    loadAnalyses()
  }, [contractId])

  const loadAnalyses = async () => {
    const res = await fetch(`${baseUrl}/api/ai-analysis?contract_id=${contractId}`)
    const data = await res.json()
    setAnalyses(data.analyses ?? [])
  }

  const runAnalysis = async (type: 'legal_review' | 'passport') => {
    if (!selectedVersion) {
      alert('Выберите версию документа для анализа')
      return
    }

    const version = versions.find(v => v.id === selectedVersion)
    if (!version) return

    setAnalyzing(type)

    try {
      const res = await fetch(`${baseUrl}/api/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          version_id: version.id,
          file_url: version.file_url,
          file_name: version.file_name,
          analysis_type: type,
          user_name: user?.name ?? 'Система',
        }),
      })

      const data = await res.json()
      if (data.success) {
        await loadAnalyses()
        setActiveTab(type)
      } else {
        alert('Ошибка анализа: ' + data.error)
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setAnalyzing(null)
    }
  }

  const latestReview = analyses.find(a => a.type === 'legal_review' && a.status === 'completed')
  const latestPassport = analyses.find(a => a.type === 'passport' && a.status === 'completed')

  const renderLegalReview = (result: LegalReview) => (
    <div className="space-y-4">
      {/* Общий риск */}
      <div className={`rounded-lg border px-4 py-3 ${RISK_COLORS[result.overall_risk]}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{RISK_ICONS[result.overall_risk]}</span>
          <div>
            <p className="text-sm font-semibold">Общий уровень риска: {RISK_LABELS[result.overall_risk]}</p>
            <p className="text-xs mt-0.5">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {result.red_flags?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">⚠️ Риски</h4>
          <div className="space-y-2">
            {result.red_flags.map((flag, i) => (
              <div key={i} className={`rounded-lg border p-3 ${RISK_COLORS[flag.severity]}`}>
                <div className="flex items-start gap-2">
                  <span>{RISK_ICONS[flag.severity]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-xs mt-0.5">{flag.description}</p>
                    {flag.recommendation && (
                      <p className="text-xs mt-1 italic">💡 {flag.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Предупреждения */}
      {result.warnings?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">📋 Замечания</h4>
          <div className="space-y-2">
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-800">{w.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Позитивные моменты */}
      {result.positives?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">✅ Защита интересов</h4>
          <div className="space-y-2">
            {result.positives.map((p, i) => (
              <div key={i} className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-medium text-green-800">{p.title}</p>
                <p className="text-xs text-green-700 mt-0.5">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderPassport = (result: Passport) => (
    <div className="space-y-4">
      {/* Суть */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">📄 Суть договора</h4>
        <p className="text-sm text-blue-900">{result.essence}</p>
      </div>

      {/* Ключевые условия */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">💰 Ключевые условия</h4>
        <div className="space-y-1.5">
          {Object.entries(result.key_terms ?? {}).map(([key, value]) => {
            const labels: Record<string, string> = {
              amount: 'Сумма',
              payment_terms: 'Оплата',
              start_date: 'Начало',
              end_date: 'Окончание',
              auto_renewal: 'Автопролонгация',
            }
            return (
              <div key={key} className="flex gap-2">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{labels[key] ?? key}:</span>
                <span className="text-xs text-gray-900">{value}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Обязательства */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Наши обязательства</h4>
          <ul className="space-y-1">
            {result.parties?.our_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">• {o}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Обязательства контрагента</h4>
          <ul className="space-y-1">
            {result.parties?.counterparty_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">• {o}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Контрольные точки */}
      {result.control_points?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">🎯 Контрольные точки</h4>
          <ul className="space-y-1">
            {result.control_points.map((p, i) => (
              <li key={i} className="text-xs text-gray-600">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Зоны внимания */}
      {result.attention_zones?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2">⚡ Зоны внимания</h4>
          <ul className="space-y-1">
            {result.attention_zones.map((z, i) => (
              <li key={i} className="text-xs text-yellow-800">• {z}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Расторжение */}
      {result.termination && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">🚪 Расторжение</h4>
          <p className="text-xs text-gray-600">{result.termination}</p>
        </div>
      )}
    </div>
  )

  if (versions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">🤖 EpotosGPT — AI анализ</h2>
        <p className="text-sm text-gray-400">Загрузите документ чтобы запустить AI анализ</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700">🤖 EpotosGPT — AI анализ</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {versions.length > 1 && (
            <select
              value={selectedVersion}
              onChange={e => setSelectedVersion(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version_number} — {v.file_name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => runAnalysis('legal_review')}
            disabled={!!analyzing}
            className="text-xs font-medium bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {analyzing === 'legal_review' ? 'Анализ...' : 'Legal Review'}
          </button>
          <button
            onClick={() => runAnalysis('passport')}
            disabled={!!analyzing}
            className="text-xs font-medium border border-gray-900 text-gray-900 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {analyzing === 'passport' ? 'Создание...' : 'Паспорт договора'}
          </button>
        </div>
      </div>

      {/* Вкладки */}
      {(latestReview || latestPassport) && (
        <div className="flex gap-2 mb-4">
          {latestReview && (
            <button
              onClick={() => setActiveTab('legal_review')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${activeTab === 'legal_review' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Legal Review
            </button>
          )}
          {latestPassport && (
            <button
              onClick={() => setActiveTab('passport')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${activeTab === 'passport' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Паспорт договора
            </button>
          )}
        </div>
      )}

      {/* Контент */}
      {analyzing && (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-sm text-gray-600">AI анализирует документ...</p>
          <p className="text-xs text-gray-400 mt-1">Это может занять 20-40 секунд</p>
        </div>
      )}

      {!analyzing && activeTab === 'legal_review' && latestReview && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Анализ от {new Date(latestReview.created_at).toLocaleString('ru-RU')} · {latestReview.model_used}
          </p>
          {renderLegalReview(latestReview.result_json as LegalReview)}
        </div>
      )}

      {!analyzing && activeTab === 'passport' && latestPassport && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Создан {new Date(latestPassport.created_at).toLocaleString('ru-RU')} · {latestPassport.model_used}
          </p>
          {renderPassport(latestPassport.result_json as Passport)}
        </div>
      )}

      {!analyzing && !latestReview && !latestPassport && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">Нажмите кнопку для запуска анализа</p>
          <p className="text-xs text-gray-300 mt-1">Legal Review найдёт риски · Паспорт создаст резюме</p>
        </div>
      )}
    </div>
  )
}