'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Template {
  id: string
  name: string
  type?: string | null
  company_prefix?: string | null | null
  file_name: string
}

interface Counterparty {
  id: string
  full_name: string
  short_name: string | null
  inn: string
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  phone?: string | null
  bank_name?: string | null
  bank_account?: string | null
  bank_bik?: string | null
  bank_corr_account?: string | null
  signatory_name: string | null
  poa_number: string | null
  poa_date: string | null
}

interface Contract {
  id: string
  number: string
  title: string
  type?: string | null
  company_prefix?: string | null
  counterparty_id?: string | null
  author_bitrix_id?: number | null
  document_category?: string | null
}

interface GenerateFromTemplateProps {
  contract: Contract
  onUploaded?: () => void
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

// Конвертация числа в пропись (рубли)
function numberToWords(num: number): string {
  const ones = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять',
    'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
    'шестнадцать','семнадцать','восемнадцать','девятнадцать']
  const onesFem = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять',
    'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
    'шестнадцать','семнадцать','восемнадцать','девятнадцать']
  const tens = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто']
  const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот']
  const millions = ['','один миллион','два миллиона','три миллиона','четыре миллиона',
    'пять миллионов','шесть миллионов','семь миллионов','восемь миллионов','девять миллионов',
    'десять миллионов','одиннадцать миллионов','двенадцать миллионов','тринадцать миллионов',
    'четырнадцать миллионов','пятнадцать миллионов','шестнадцать миллионов',
    'семнадцать миллионов','восемнадцать миллионов','девятнадцать миллионов']
  const tenMillions = ['','','двадцать миллионов','тридцать миллионов','сорок миллионов',
    'пятьдесят миллионов','шестьдесят миллионов','семьдесят миллионов',
    'восемьдесят миллионов','девяносто миллионов']

  if (num === 0) return 'ноль'
  if (num >= 1000000000) return num.toString()

  let result = ''
  const m = Math.floor(num / 1000000)
  const th = Math.floor((num % 1000000) / 1000)
  const rest = num % 1000

  if (m > 0 && m < 20) result += millions[m] + ' '
  else if (m >= 20) result += tenMillions[Math.floor(m/10)] + (m%10 ? ' ' + millions[m%10] : '') + ' '

  if (th > 0) {
    const h = Math.floor(th/100)
    const t = th % 100
    if (h > 0) result += hundreds[h] + ' '
    const onesFem = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять',
      'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
      'шестнадцать','семнадцать','восемнадцать','девятнадцать']
    if (t < 20) result += (t > 0 ? onesFem[t] : '') + (t === 1 ? ' тысяча' : t >= 2 && t <= 4 ? ' тысячи' : t > 0 ? ' тысяч' : t === 0 && h > 0 ? ' тысяч' : '') + ' '
    else result += tens[Math.floor(t/10)] + (t%10 ? ' ' + onesFem[t%10] : '') + ' тысяч '
  }

  if (rest > 0) {
    const h = Math.floor(rest/100)
    const t = rest % 100
    if (h > 0) result += hundreds[h] + ' '
    if (t < 20) result += ones[t] + ' '
    else result += tens[Math.floor(t/10)] + (t%10 ? ' ' + ones[t%10] : '') + ' '
  }

  return result.trim()
}

const MONTH_NAMES = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'
]

// Поля которые пользователь вводит вручную — по типу шаблона
const EXTRA_FIELDS: Record<string, { key: string; label: string; placeholder?: string; type?: string }[]> = {
  'дилерский': [
    { key: 'territory', label: 'Территория', placeholder: 'Московская область' },
    { key: 'min_monthly_purchase_num', label: 'Минимальный объём закупки (цифрами)', placeholder: '2000000' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'dealer_rf': [
    { key: 'territory', label: 'Территория', placeholder: 'Московская область' },
    { key: 'min_monthly_purchase_num', label: 'Минимальный объём закупки (цифрами)', placeholder: '2 000 000' },
    { key: 'min_monthly_purchase_text', label: 'Минимальный объём закупки (прописью)', placeholder: 'два миллиона' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'dealer_sng': [
    { key: 'territory_country', label: 'Страна/территория', placeholder: 'Республика Казахстан' },
    { key: 'tax_authority_country', label: 'Налоговый орган страны', placeholder: 'Казахстан' },
    { key: 'min_monthly_purchase_num', label: 'Минимальный объём закупки (цифрами)', placeholder: '2 000 000' },
    { key: 'min_monthly_purchase_text', label: 'Минимальный объём закупки (прописью)', placeholder: 'два миллиона' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'асц': [
    { key: 'territory', label: 'Территория', placeholder: 'Московская область' },
    { key: 'insurance_amount_num', label: 'Сумма страхования (цифрами, если есть)', placeholder: '5 000 000' },
    { key: 'transport_types', label: 'Типы транспортных средств (если есть)', placeholder: 'грузовые автомобили' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'asc_no_to': [
    { key: 'territory', label: 'Территория', placeholder: 'Московская область' },
    { key: 'insurance_amount_num', label: 'Сумма страхования (цифрами)', placeholder: '5 000 000' },
    { key: 'insurance_amount_text', label: 'Сумма страхования (прописью)', placeholder: 'пять миллионов' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'asc_with_to': [
    { key: 'territory', label: 'Территория', placeholder: 'Московская область' },
    { key: 'transport_types', label: 'Типы транспортных средств', placeholder: 'грузовые автомобили' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'поставка': [
    { key: 'payment_days', label: 'Срок оплаты (дней)', placeholder: '5' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
    { key: 'territory_country', label: 'Страна/территория (для СНГ)', placeholder: 'Республика Казахстан' },
    { key: 'tax_authority_country', label: 'Налоговый орган страны (для СНГ)', placeholder: 'Казахстан' },
  ],
  'supply_rf': [
    { key: 'payment_days', label: 'Срок оплаты (дней)', placeholder: '5' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'supply_rf_supervision': [
    { key: 'payment_days', label: 'Срок оплаты (дней)', placeholder: '5' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'supply_sng': [
    { key: 'territory_country', label: 'Страна/территория', placeholder: 'Республика Казахстан' },
    { key: 'tax_authority_country', label: 'Налоговый орган страны', placeholder: 'Казахстан' },
    { key: 'payment_days', label: 'Срок оплаты (дней)', placeholder: '5' },
    { key: 'contract_end_date', label: 'Дата окончания договора', placeholder: '31.12.2026' },
  ],
  'nda': [
    { key: 'nda_penalty_num', label: 'Штраф за разглашение (цифрами)', placeholder: '1000000' },
    { key: 'nda_penalty_kopecks', label: 'Копеек', placeholder: '00' },
  ],
  'эдо': [
    { key: 'edo_operator', label: 'Оператор ЭДО контрагента', placeholder: 'Диадок' },
    { key: 'referenced_contract_number', label: 'Номер основного договора', placeholder: 'ТХ-ДОГ-2026/05/1' },
    { key: 'referenced_contract_date', label: 'Дата основного договора', placeholder: '01.05.2026' },
    { key: 'contract_end_date', label: 'Дата окончания соглашения', placeholder: '31.12.2026' },
  ],
  'edo': [
    { key: 'edo_operator', label: 'Оператор ЭДО контрагента', placeholder: 'Диадок' },
    { key: 'referenced_contract_number', label: 'Номер основного договора', placeholder: 'ТХ-ДОГ-2026/05/1' },
    { key: 'referenced_contract_date', label: 'Дата основного договора', placeholder: '01.05.2026' },
  ],
  'персданные': [
    { key: 'subject_full_name', label: 'ФИО физлица', placeholder: 'Иванов Иван Иванович' },
    { key: 'subject_birth_year', label: 'Год рождения', placeholder: '1985' },
    { key: 'passport_series', label: 'Серия паспорта', placeholder: '4510' },
    { key: 'passport_number', label: 'Номер паспорта', placeholder: '123456' },
    { key: 'passport_issued_by', label: 'Кем выдан', placeholder: 'ОУФМС России' },
    { key: 'passport_dept_code', label: 'Код подразделения', placeholder: '770-001' },
    { key: 'subject_address', label: 'Адрес регистрации', placeholder: 'г. Москва, ул. ...' },
    { key: 'subject_inn', label: 'ИНН физлица', placeholder: '770123456789' },
    { key: 'subject_snils', label: 'СНИЛС', placeholder: '123-456-789 00' },
    { key: 'pd_consent_date', label: 'Согласие действует до', placeholder: '31.12.2029', type: 'date' },
  ],
  'pd_consent': [
    { key: 'subject_full_name', label: 'ФИО физлица', placeholder: 'Иванов Иван Иванович' },
    { key: 'subject_birth_year', label: 'Год рождения', placeholder: '1985' },
    { key: 'passport_series', label: 'Серия паспорта', placeholder: '4510' },
    { key: 'passport_number', label: 'Номер паспорта', placeholder: '123456' },
    { key: 'passport_issued_by', label: 'Кем выдан', placeholder: 'ОУФМС России' },
    { key: 'passport_dept_code', label: 'Код подразделения', placeholder: '770-001' },
    { key: 'subject_address', label: 'Адрес регистрации', placeholder: 'г. Москва, ул. ...' },
    { key: 'subject_inn', label: 'ИНН физлица', placeholder: '770123456789' },
    { key: 'subject_snils', label: 'СНИЛС', placeholder: '123-456-789 00' },
    { key: 'pd_consent_years', label: 'Срок согласия (лет)', placeholder: '3' },
  ],
}

export default function GenerateFromTemplate({ contract, onUploaded }: GenerateFromTemplateProps) {
  const { user } = useBitrixAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [counterpartyMode, setCounterpartyMode] = useState<'select' | 'empty'>('select')
  const [selectedCounterparty, setSelectedCounterparty] = useState<Counterparty | null>(null)
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})
  const [contractDate, setContractDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const [generatedFileName, setGeneratedFileName] = useState('')
  const [step, setStep] = useState<'select' | 'form' | 'done'>('select')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Определяем префикс компании из номера документа если не задан явно
  const effectivePrefix = contract.company_prefix ?? contract.number?.split('-')[0] ?? ''

  // Загружаем шаблоны для компании
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(
        `${baseUrl}/api/generate-from-template?company_prefix=${effectivePrefix}`
      )
      const json = await res.json()
      setTemplates(json.templates ?? [])
      setLoading(false)
    }
    load()
  }, [contract.company_prefix])

  // Загружаем контрагентов
  useEffect(() => {
    fetch(`${baseUrl}/api/counterparties`)
      .then(r => r.json())
      .then(d => setCounterparties(d.counterparties ?? []))
  }, [])

  // Дата сегодня по умолчанию
  useEffect(() => {
    const today = new Date()
    const day = today.getDate().toString()
    const month = MONTH_NAMES[today.getMonth()]
    const year = today.getFullYear().toString()
    setContractDate(`${day} ${month} ${year}`)
  }, [])

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t)
    setExtraFields({})
    setStep('form')
  }

  const buildFields = async () => {
    // Авто-поля из карточки документа
    const today = new Date()
    const day = today.getDate().toString()
    const month = MONTH_NAMES[today.getMonth()]
    const year = today.getFullYear().toString()

    // Реквизиты нашей компании из БД
    const reqRes = await fetch(
      `${baseUrl}/api/company-requisites?prefix=${effectivePrefix}`
    )
    const reqJson = await reqRes.json()
    const req = reqJson.requisites?.[0] ?? {}

    // Данные контрагента
    const cp = counterpartyMode === 'select' && selectedCounterparty
      ? selectedCounterparty
      : null

    const fields: Record<string, string> = {
      // Документ
      contract_number: contract.number,
      contract_date: contractDate,
      contract_day: day,
      contract_month: month,
      contract_year: year,
      // Наша компания
      supplier_full_name: req.company_name ?? '',
      supplier_short_name: req.short_name ?? '',
      supplier_director_title: req.director_title ?? 'Генерального директора',
      supplier_director_name: req.director_name ?? '',
      supplier_director_short_name: req.director_short_name ?? '',
      supplier_basis: req.basis ?? 'Устава',
      supplier_ogrn: req.ogrn ?? '',
      supplier_inn: req.inn ?? '',
      supplier_kpp: req.kpp ?? '',
      supplier_legal_address: req.legal_address ?? '',
      supplier_warehouse_address: req.warehouse_address ?? '',
      supplier_phone: req.phone ?? '',
      supplier_fax: req.fax ?? '',
      supplier_email: req.email ?? '',
      supplier_bank_name: req.bank_name ?? '',
      supplier_bank_account: req.bank_account ?? '',
      supplier_bank_corr_account: req.bank_corr_account ?? '',
      supplier_bank_bik: req.bank_bik ?? '',
      // Контрагент
      counterparty_full_name: cp?.full_name ?? '',
      counterparty_short_name: cp?.short_name ?? '',
      counterparty_signatory: cp?.signatory_name ?? (cp as {director_name?: string})?.director_name ?? '',
      counterparty_signatory_title: 'Генерального директора',
      counterparty_basis: cp?.poa_number
        ? `доверенности № ${cp.poa_number} от ${cp.poa_date ?? ''}`
        : 'Устава',
      counterparty_inn: (cp as {inn?: string})?.inn ?? '',
      counterparty_kpp: (cp as {kpp?: string})?.kpp ?? '',
      counterparty_ogrn: (cp as {ogrn?: string})?.ogrn ?? '',
      counterparty_address: (cp as {legal_address?: string})?.legal_address ?? '',
      counterparty_phone: (cp as {phone?: string})?.phone ?? '',
      counterparty_bank_name: (cp as {bank_name?: string})?.bank_name ?? '',
      counterparty_bank_account: (cp as {bank_account?: string})?.bank_account ?? '',
      counterparty_bank_bik: (cp as {bank_bik?: string})?.bank_bik ?? '',
      counterparty_bank_corr: (cp as {bank_corr_account?: string})?.bank_corr_account ?? '',
      // Автоконвертация суммы прописью
      ...(extraFields.nda_penalty_num ? {
        nda_penalty_text: numberToWords(parseInt(extraFields.nda_penalty_num.replace(/\s/g, '').replace(/,/g, ''), 10))
      } : {}),
      ...(extraFields.insurance_amount_num ? {
        insurance_amount_text: numberToWords(parseInt(extraFields.insurance_amount_num.replace(/\s/g, '').replace(/,/g, ''), 10))
      } : {}),
      ...(extraFields.min_monthly_purchase_num ? {
        min_monthly_purchase_text: numberToWords(parseInt(extraFields.min_monthly_purchase_num.replace(/\s/g, '').replace(/,/g, ''), 10))
      } : {}),
      // Дополнительные поля
      ...extraFields,
    }

    return fields
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) return
    setGenerating(true)
    try {
      const fields = await buildFields()
      console.log('Sending fields:', JSON.stringify(fields).slice(0, 500))
      const res = await fetch(`${baseUrl}/api/generate-from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          fields,
          contract_id: contract.id,
          user_name: user?.name ?? 'Пользователь',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Ошибка генерации')
      }
      const blob = await res.blob()
      const fileName = `${contract.number} — ${selectedTemplate.name}.docx`
      setGeneratedBlob(blob)
      setGeneratedFileName(fileName)
      setStep('done')
    } catch (e) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!generatedBlob) return
    const url = URL.createObjectURL(generatedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = generatedFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadToCard = async (category: 'main' | 'attachment') => {
    if (!generatedBlob || !user?.id) return
    setUploading(true)
    try {
      const safeFileName = generatedFileName.replace(/\//g, '-')
      const formData = new FormData()
      formData.append('file', generatedBlob, safeFileName)
      formData.append('contract_id', contract.id)
      formData.append('user_name', user.name ?? 'Пользователь')

      let endpoint: string
      if (category === 'main') {
        formData.append('comment', 'Сгенерировано из шаблона')
        endpoint = `${baseUrl}/api/versions`
      } else {
        formData.append('attachment_type', 'Другое')
        formData.append('title', generatedFileName)
        formData.append('user_bitrix_id', user.id)
        endpoint = `${baseUrl}/api/attachments`
      }

      const res = await fetch(endpoint, { method: 'POST', body: formData })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? 'Ошибка загрузки')
      }
      router.refresh()
      router.refresh()
      if (onUploaded) onUploaded()
      alert(category === 'main'
        ? '✅ Документ добавлен как основная версия'
        : '✅ Документ добавлен как дополнительный материал'
      )
    } catch (e) {
      alert('Ошибка загрузки: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setUploading(false)
    }
  }

  // ШАГ 1 — Выбор шаблона
  if (step === 'select') {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Выберите шаблон документа</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Загрузка шаблонов...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400">Шаблоны для компании «{effectivePrefix || 'не определена'}» не найдены</p>
        ) : (
          <div className="grid gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => handleSelectTemplate(t)}
                className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.file_name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ШАГ 2 — Форма заполнения полей
  if (step === 'form' && selectedTemplate) {
    const extraFieldsDef = EXTRA_FIELDS[selectedTemplate.type ?? ''] ?? []
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('select')}
            className="text-xs text-gray-400 hover:text-gray-700">← Назад</button>
          <h3 className="text-sm font-semibold text-gray-900">{selectedTemplate.name}</h3>
        </div>

        {/* Дата документа */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Дата документа</label>
          <input type="date" 
            onChange={e => {
              if (!e.target.value) return
              const d = new Date(e.target.value)
              const months = ['января','февраля','марта','апреля','мая','июня',
                'июля','августа','сентября','октября','ноября','декабря']
              setContractDate(`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`)
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400" />
          <p className="text-xs text-gray-400 mt-1">Выбрано: {contractDate}</p>
        </div>

        {/* Контрагент — скрыт для согласия ПД */}
        {selectedTemplate.type !== 'персданные' && <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700 block">Контрагент</label>
          <div className="flex gap-2">
            <button onClick={() => setCounterpartyMode('select')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${counterpartyMode === 'select' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
              Выбрать из реестра
            </button>
            <button onClick={() => { setCounterpartyMode('empty'); setSelectedCounterparty(null) }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${counterpartyMode === 'empty' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
              Оставить пустым
            </button>
          </div>
          {counterpartyMode === 'select' && (
            <select value={selectedCounterparty?.id ?? ''}
              onChange={e => {
                const cp = counterparties.find(c => c.id === e.target.value) ?? null
                setSelectedCounterparty(cp)
              }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400">
              <option value="">— Выберите контрагента —</option>
              {counterparties.map(cp => (
                <option key={cp.id} value={cp.id}>
                  {cp.short_name ?? cp.full_name} (ИНН {cp.inn})
                </option>
              ))}
            </select>
          )}
          {counterpartyMode === 'empty' && (
            <p className="text-xs text-gray-400">Поля контрагента будут заполнены подчёркиваниями</p>
          )}
        </div>}

        {/* Дополнительные поля */}
        {extraFieldsDef.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-700">Дополнительные условия</p>
            {extraFieldsDef.map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-600 block mb-1">{f.label}</label>
                {f.type === 'date' ? (
                  <input type="date"
                    onChange={e => {
                      if (!e.target.value) return
                      const [year, month, day] = e.target.value.split('-')
                      const formatted = `${day}.${month}.${year}`
                      setExtraFields(prev => ({ ...prev, [f.key]: formatted }))
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400" />
                ) : (
                  <input type="text" value={extraFields[f.key] ?? ''}
                    onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400" />
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleGenerate} disabled={generating}
          className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {generating ? 'Формирование...' : '📄 Сформировать документ'}
        </button>
      </div>
    )
  }

  // ШАГ 3 — Готово, выбор действия
  if (step === 'done') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-semibold text-green-800">Документ сформирован</p>
          <p className="text-xs text-green-600 mt-1">{generatedFileName}</p>
        </div>

        <p className="text-xs font-medium text-gray-700">Что сделать с документом?</p>

        <div className="space-y-2">
          <button onClick={handleDownload}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <span className="text-lg">💾</span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Скачать на компьютер</p>
              <p className="text-xs text-gray-400">Сохранить файл .docx локально</p>
            </div>
          </button>

          <button onClick={() => handleUploadToCard('main')} disabled={uploading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <span className="text-lg">📌</span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Добавить как основной документ</p>
              <p className="text-xs text-gray-400">Загрузить как новую версию в карточку</p>
            </div>
          </button>

          <button onClick={() => handleUploadToCard('attachment')} disabled={uploading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <span className="text-lg">📎</span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Добавить как доп. материал</p>
              <p className="text-xs text-gray-400">Загрузить во вкладку «Доп. материалы»</p>
            </div>
          </button>
        </div>

        <button onClick={() => { setStep('select'); setGeneratedBlob(null); setSelectedTemplate(null) }}
          className="w-full text-xs text-gray-400 hover:text-gray-700 py-2">
          ← Сформировать другой документ
        </button>
      </div>
    )
  }

  return null
}