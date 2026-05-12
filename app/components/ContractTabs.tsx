'use client'
import { buildChatHtml } from '@/utils/chatPrint'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ApproveButton from '@/app/components/ApproveButton'
import DelegateApproveCheckbox from '@/app/components/DelegateApproveCheckbox'
import DeleteContractButton from '@/app/components/DeleteContractButton'
import AIAnalysis from '@/app/components/AIAnalysis'

const ATTACHMENT_TYPES = [
  'Спецификация',
  'Приложение',
  'Дополнительное соглашение',
  'Протокол разногласий',
  'Акт',
  'Другое',
]
import AIGenerate from '@/app/components/AIGenerate'
import CancelApprovalButton from '@/app/components/CancelApprovalButton'
import dynamic from 'next/dynamic'
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const baseUrl = 'https://epotos-ur-intel.vercel.app'

interface Version {
  id: string
  version_number: number
  file_name: string
  file_url: string
  comment: string | null
  created_at: string
}

interface Log {
  id: string
  action: string
  details: string | null
  user_name: string
  created_at: string
}

interface Contract {
  id: string
  number: string
  title: string
  counterparty: string
  type: string | null
  status: string
  amount: number | null
  start_date: string | null
  end_date: string | null
  author_bitrix_id: number | null
  allow_others_to_approve: boolean | null
  document_category?: string | null
  company_prefix?: string | null
  signed_at?: string | null
  signed_by_name?: string | null
  signed_by_bitrix_id?: number | null
  signed_file_url?: string | null
  signed_file_name?: string | null
  signed_file_uploaded_at?: string | null
  signed_file_uploaded_by?: string | null
}

interface Participant {
  id: string
  user_name: string
  department: string | null
  role: string
  stage: string
  status: string
  comment: string | null
  decided_at: string | null
  bitrix_user_id: number | null
}

interface Message {
  id: string
  author_name: string
  message: string
  is_ai: boolean
  created_at: string
  bitrix_user_id: number | null
  session_id: string
  file_url?: string | null
  file_name?: string | null
  file_type?: string | null
}

interface Session {
  id: string
  status: string
  deadline: string
  initiated_by_name: string
  initiated_by_bitrix_id: number | null
  created_at: string
  approval_participants: Participant[]
  approval_messages: Message[]
}

interface Props {
  contract: Contract
  versions: Version[]
  logs: Log[]
}

const statusLabel: Record<string, string> = {
  черновик: 'Черновик',
  на_согласовании: 'На согласовании',
  согласован: 'Согласован',
  отклонён: 'Отклонён',
  загружен_частично: 'Документы загружены частично',
  подписан: 'Подписанные документы загружены',
  на_исполнении: 'На контроле исполнения',
  архив: 'Архив',
}

const statusColor: Record<string, string> = {
  черновик: 'bg-gray-100 text-gray-700',
  на_согласовании: 'bg-yellow-100 text-yellow-800',
  согласован: 'bg-blue-100 text-blue-800',
  отклонён: 'bg-red-100 text-red-700',
  загружен_частично: 'bg-orange-100 text-orange-800',
  подписан: 'bg-green-100 text-green-800',
  на_исполнении: 'bg-emerald-100 text-emerald-800',
  архив: 'bg-gray-200 text-gray-500',
}

const STAGE_LABELS: Record<string, string> = {
  legal: 'Юридический',
  finance: 'Финансовый',
  accounting: 'Бухгалтерия',
  director: 'Директор',
  custom: 'Доп.',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'В работе',
  approved: 'Согласовал',
  acknowledged: 'Ознакомлен',
  disabled: 'Отключён',
  completed_by_initiator: 'Завершён',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  disabled: 'bg-gray-100 text-gray-500',
  completed_by_initiator: 'bg-gray-200 text-gray-600',
}

export default function ContractTabs({ contract, versions, logs }: Props) {
  const { user } = useBitrixAuth()
  const ADMIN_IDS = [30, 1148]
  const GC_MANAGER_IDS = [1, 246, 504]
  const userId = parseInt(user?.id ?? '0')
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const initialTab = searchParams?.get('tab') ?? 'details'
  const [activeTab, setActiveTab] = useState(initialTab)
  const canSign = ADMIN_IDS.includes(userId) ||
    GC_MANAGER_IDS.includes(userId) ||
    contract.author_bitrix_id === userId

  const SPECIAL_SIGNERS: Record<number, string[]> = {
    782: ['Э-К'],
    152: ['СПТ', 'ОС', 'НПП'],
  }
  const canUploadSigned = ADMIN_IDS.includes(userId) ||
    GC_MANAGER_IDS.includes(userId) ||
    contract.author_bitrix_id === userId ||
    Object.entries(SPECIAL_SIGNERS).some(([id, prefixes]) =>
      parseInt(id) === userId && prefixes.includes(contract.company_prefix ?? '')
    )
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastReadTime, setLastReadTime] = useState(() => {
    if (typeof window === 'undefined') return new Date().toISOString()
    return localStorage.getItem(`chat_read_time_${contract.id}`) ?? new Date().toISOString()
  })
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
  const [attachments, setAttachments] = useState<{id: string, attachment_type: string, number: number, title: string | null, file_url: string, file_name: string, comment: string | null, created_at: string}[]>([])
  const [signedDocs, setSignedDocs] = useState<{id: string; file_url: string; file_name: string; uploaded_by_name: string; created_at: string}[]>([])
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false)
  const [uploadingSignedFile, setUploadingSignedFile] = useState(false)
  const [showAttachmentForm, setShowAttachmentForm] = useState(false)
  const [attachmentType, setAttachmentType] = useState('Спецификация')
  const [attachmentTitle, setAttachmentTitle] = useState('')
  const [attachmentComment, setAttachmentComment] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [newParticipantName, setNewParticipantName] = useState('')
  const [newParticipantRole, setNewParticipantRole] = useState<'required' | 'optional'>('required')
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addParticipantOptions, setAddParticipantOptions] = useState<{id: string, user_name: string, bitrix_user_id: number, department: string | null}[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [contractStatus, setContractStatus] = useState(contract.status)
  const [approving, setApproving] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadAttachments = async () => {
    const res = await fetch(`${baseUrl}/api/attachments?contract_id=${contract.id}`)
    const data = await res.json()
    setAttachments(data.attachments ?? [])
  }

  const handleUploadAttachment = async () => {
    if (!attachmentFile) return
    setUploadingAttachment(true)

    const formData = new FormData()
    formData.append('file', attachmentFile)
    formData.append('contract_id', contract.id)
    formData.append('attachment_type', attachmentType)
    formData.append('title', attachmentTitle)
    formData.append('comment', attachmentComment)
    formData.append('user_name', user?.name ?? 'Система')
    formData.append('user_bitrix_id', user?.id ?? '')

    const res = await fetch(`${baseUrl}/api/attachments`, { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      alert('Ошибка: ' + data.error)
    } else {
      setShowAttachmentForm(false)
      setAttachmentFile(null)
      setAttachmentTitle('')
      setAttachmentComment('')
      await loadAttachments()
    }
    setUploadingAttachment(false)
  }

  const handleDeleteAttachment = async (id: string, file_url: string) => {
    if (!confirm('Удалить дополнительный материал?')) return
    await fetch(`${baseUrl}/api/attachments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, file_url, contract_id: contract.id, user_name: user?.name }),
    })
    await loadAttachments()
  }

  const loadSession = async () => {
    const res = await fetch(`${baseUrl}/api/approvals?contract_id=${contract.id}`)
    const data = await res.json()
    if (data.session) {
      data.session.approval_messages = (data.session.approval_messages ?? [])
        .sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    setSession(data.session)
    setSessionLoading(false)
  }

  useEffect(() => {
    loadSession()
    loadAttachments()
  }, [contract.id])

  useEffect(() => {
    const loadSignedDocs = async () => {
      const res = await fetch(`https://epotos-ur-intel.vercel.app/api/signed-documents?contract_id=${contract.id}`)
      const data = await res.json()
      if (data.documents) setSignedDocs(data.documents)
    }
    loadSignedDocs()
  }, [contract.id])

  useEffect(() => {
    if (activeTab === 'chat') {
      const now = new Date().toISOString()
      setLastReadTime(now)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`chat_read_time_${contract.id}`, now)
      }
      setUnreadCount(0)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      const unread = (session?.approval_messages ?? []).filter(
        m => new Date(m.created_at) > new Date(lastReadTime)
      ).length
      setUnreadCount(unread)
    }
  }, [session?.approval_messages, activeTab])

  // Realtime
  useEffect(() => {
    if (!session?.id) return
    const channel = supabaseClient
      .channel(`tabs-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'approval_messages' },
        (payload) => {
          const newMsg = payload.new as Message
          if (newMsg.session_id !== session.id) return
          setSession(prev => {
            if (!prev) return prev
            if (prev.approval_messages.find(m => m.id === newMsg.id)) return prev
            return {
              ...prev,
              approval_messages: [...prev.approval_messages, newMsg]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            }
          })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_participants' },
        () => loadSession())
      .subscribe()
    return () => { supabaseClient.removeChannel(channel) }
  }, [session?.id])

  const myParticipant = session?.approval_participants.find(
    p => p.bitrix_user_id === parseInt(user?.id ?? '0')
  )

  const handleAddParticipant = async () => {
    if (!session || !newParticipantName.trim()) return
    setAddingParticipant(true)

    const found = addParticipantOptions.find(p => p.user_name === newParticipantName)

    await fetch(`https://epotos-ur-intel.vercel.app/api/approvals/${session.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: newParticipantName,
        bitrix_user_id: found?.bitrix_user_id ?? null,
        department: found?.department ?? null,
        role: newParticipantRole,
        stage: 'custom',
        added_by_name: user?.name ?? 'Система',
        contract_id: contract.id,
      }),
    })

    setShowAddParticipantModal(false)
    setNewParticipantName('')
    setNewParticipantRole('required')
    setAddingParticipant(false)
    await loadSession()
  }

  const openAddParticipantModal = async () => {
    // Определяем компанию из номера договора
    const companyPrefix = contract.number.split('-')[0]
    
    // Загружаем участников всех этапов для этой компании
    const stages = ['legal', 'finance', 'accounting', 'director', 'custom']
    const allParticipants: typeof addParticipantOptions = []
    const seenIds = new Set<number>()

    for (const stage of stages) {
      const res = await fetch(`https://epotos-ur-intel.vercel.app/api/approval-settings?stage=${stage}&company=${companyPrefix}`)
      const data = await res.json()
      for (const p of (data.participants ?? [])) {
        if (!seenIds.has(p.bitrix_user_id)) {
          seenIds.add(p.bitrix_user_id)
          allParticipants.push(p)
        }
      }
    }

    // Исключаем уже добавленных участников
    const existingIds = new Set(
      session?.approval_participants.map(p => p.bitrix_user_id).filter(Boolean) ?? []
    )
    const filtered = allParticipants.filter(p => !existingIds.has(p.bitrix_user_id))

    setAddParticipantOptions(filtered)
    setShowAddParticipantModal(true)
  }

  const handleEditMessage = async (messageId: string) => {
    if (!editingMessageText.trim() || !session) return
    await fetch(`${baseUrl}/api/approvals/${session.id}/messages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageId,
        message: editingMessageText.trim(),
        bitrix_user_id: user?.id ? parseInt(user.id) : null,
      }),
    })
    setEditingMessageId(null)
    setEditingMessageText('')
  }

  const handleFileUpload = async (file: File) => {
    if (!session) return
    setUploadingFile(true)

    try {
      const safeFileName = file.name
        .replace(/[а-яёА-ЯЁ\s]/g, (char) => {
          const map: Record<string, string> = {
            'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
            'й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
            'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
            'э':'e','ю':'yu','я':'ya',' ':'_',
            'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I',
            'Й':'J','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T',
            'У':'U','Ф':'F','Х':'H','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ъ':'','Ы':'Y','Ь':'',
            'Э':'E','Ю':'Yu','Я':'Ya'
          }
          return map[char] ?? '_'
        })
      const fileExt = file.name.split('.').pop()
      const filePath = `chat/${session.id}/${Date.now()}_${safeFileName}`

      const { createClient } = await import('@supabase/supabase-js')
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      const { error: uploadError } = await supabaseClient.storage
        .from('contracts')
        .upload(filePath, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        alert('Ошибка загрузки файла: ' + uploadError.message)
        return
      }

      const { data: urlData } = supabaseClient.storage
        .from('contracts')
        .getPublicUrl(filePath)

      const isImage = file.type.startsWith('image/')

      await fetch(`https://epotos-ur-intel.vercel.app/api/approvals/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: isImage ? '' : file.name,
          author_name: user?.name ?? 'Гость',
          bitrix_user_id: user?.id ? parseInt(user.id) : null,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
        }),
      })
    } catch {
      alert('Ошибка загрузки файла')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim() || !session) return
    setSendingMessage(true)
    await fetch(`${baseUrl}/api/approvals/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.trim(),
        author_name: user?.name ?? 'Гость',
        bitrix_user_id: user?.id ? parseInt(user.id) : null,
      }),
    })
    setMessage('')
    setSendingMessage(false)
  }

  const handleApprove = async () => {
    if (!session || !approvingId) return
    setApproving(true)
    await fetch(`${baseUrl}/api/approvals/${session.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: approvingId,
        comment: approveComment,
        user_name: user?.name ?? 'Система',
        contract_id: contract.id,
        is_acknowledge: false,
      }),
    })
    setShowApproveModal(false)
    setApproveComment('')
    setApprovingId(null)
    setApproving(false)
    await loadSession()
    // Обновляем статус контракта с небольшой задержкой
    setTimeout(async () => {
      const res = await fetch(`${baseUrl}/api/contracts/${contract.id}`)
      const data = await res.json()
      if (data.contract?.status) setContractStatus(data.contract.status)
    }, 1000)
  }

  const handleAcknowledge = async () => {
    if (!session || !approvingId) return
    setAcknowledging(true)
    await fetch(`${baseUrl}/api/approvals/${session.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: approvingId,
        comment: 'Ознакомлен',
        user_name: user?.name ?? 'Система',
        contract_id: contract.id,
        is_acknowledge: true,
      }),
    })
    setShowAcknowledgeModal(false)
    setApprovingId(null)
    setAcknowledging(false)
    await loadSession()
    // Обновляем статус контракта с небольшой задержкой
    setTimeout(async () => {
      const res2 = await fetch(`${baseUrl}/api/contracts/${contract.id}`)
      const data2 = await res2.json()
      if (data2.contract?.status) setContractStatus(data2.contract.status)
    }, 1000)
  }

  const hasActiveSession = session && (session.status === 'active' || session.status === 'completed')
  const allRequired = session?.approval_participants.filter(p => p.role === 'required') ?? []
  const allApproved = allRequired.every(p => ['approved', 'disabled', 'completed_by_initiator'].includes(p.status))
  const daysLeft = session ? Math.ceil((new Date(session.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  const TABS = [
    { id: 'details', label: 'Реквизиты', icon: '📋' },
    { id: 'documents', label: 'Документы', icon: '📁' },
    { id: 'approval', label: 'Согласование', icon: '✅' },
    { id: 'ai', label: 'EpotosGPT', icon: '🤖' },
    // { id: 'generate', label: 'Генерация', icon: '✨' }, // В разработке
    { id: 'chat', label: 'Чат', icon: '💬', dot: hasActiveSession, badge: unreadCount },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Шапка */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Назад</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">{contract.number}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[contract.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {statusLabel[contract.status] ?? contract.status}
            </span>
          </div>
          <DeleteContractButton contractId={contract.id} contractNumber={contract.number} />
        </div>

        {/* Вкладки */}
        <div className="flex gap-0 mb-0 flex-wrap">
          {TABS.map((tab, index) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all ${
                activeTab === tab.id
                  ? 'bg-white border-gray-200 text-gray-900 z-10 relative shadow-sm'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-50'
              } ${index > 0 ? '-ml-px' : ''}`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.dot && !(tab.badge && tab.badge > 0) && <span className="w-2 h-2 bg-green-500 rounded-full ml-0.5"></span>}
              {tab.badge && tab.badge > 0 ? (
                <span className="ml-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div className="bg-white rounded-b-xl rounded-tr-xl border border-gray-200 shadow-sm">

          {/* Реквизиты */}
          {activeTab === 'details' && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  {/* Индикатор статуса */}
                  <div className="mb-5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { s: 'черновик', label: 'Черновик', active: 'bg-gray-500 text-white', past: 'bg-gray-200 text-gray-500' },
                        { s: 'на_согласовании', label: 'На согласовании', active: 'bg-yellow-500 text-white', past: 'bg-yellow-100 text-yellow-600' },
                        { s: 'согласован', label: 'Согласован', active: 'bg-blue-500 text-white', past: 'bg-blue-100 text-blue-600' },
                        { s: 'загружен_частично', label: 'Загружены частично', active: 'bg-orange-500 text-white', past: 'bg-orange-100 text-orange-600' },
                        { s: 'подписан', label: 'Документы загружены', active: 'bg-green-500 text-white', past: 'bg-green-100 text-green-600' },
                        { s: 'на_исполнении', label: 'На исполнении', active: 'bg-emerald-600 text-white', past: 'bg-emerald-100 text-emerald-600' },
                      ].map(({ s, label, active, past }, i, arr) => {
                        const order = ['черновик','на_согласовании','согласован','загружен_частично','подписан','на_исполнении']
                        const currentIdx = order.indexOf(contractStatus)
                        const thisIdx = order.indexOf(s)
                        const isCurrent = s === contract.status
                        const isPast = thisIdx < currentIdx
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${isCurrent ? active : isPast ? past : 'bg-gray-100 text-gray-300'}`}>
                              {label}
                            </span>
                            {i < arr.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Реквизиты документа</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Название', value: contract.title },
                      { label: 'Контрагент', value: contract.counterparty },
                      { label: 'Тип', value: contract.type },
                      { label: 'Сумма', value: contract.amount ? Number(contract.amount).toLocaleString('ru-RU') + ' ₽' : '—' },
                      { label: 'Дата начала', value: contract.start_date ?? '—' },
                      { label: 'Дата окончания', value: contract.end_date ?? '—' },
                    ].map(item => (
                      <div key={item.label} className="flex gap-4">
                        <span className="text-sm text-gray-500 w-36 flex-shrink-0">{item.label}</span>
                        <span className="text-sm text-gray-900">{item.value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">История действий</h2>
                    <button onClick={() => window.location.reload()}
                      className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                      🔄 Обновить
                    </button>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                    {logs.length === 0 ? (
                      <p className="text-sm text-gray-400">История пуста</p>
                    ) : logs.map(log => (
                      <div key={log.id} className="border-l-2 border-gray-200 pl-3">
                        <p className="text-xs font-medium text-gray-900">{log.action}</p>
                        {log.details && <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>}
                        <p className="text-xs text-gray-400 mt-1">{log.user_name} · {new Date(log.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Документы */}
          {activeTab === 'documents' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Версии документа</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/contracts/${contract.id}/upload`}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                    + Загрузить версию
                  </Link>
                  
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {versions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Версий пока нет — загрузите первый документ</div>
                ) : versions.map(version => (
                  <div key={version.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-gray-900 bg-gray-200 px-2 py-1 rounded">v{version.version_number}</span>
                      <div>
                        <p className="text-sm text-gray-900">{version.file_name}</p>
                        {version.comment && <p className="text-xs text-gray-500 mt-0.5">{version.comment}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(version.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={version.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                        Скачать
                      </a>
                      {(version.file_name.endsWith('.docx') || version.file_name.endsWith('.xlsx')) && (
                        <>
                          <a href={`https://epotos-ur-intel.vercel.app/editor?version_id=${version.id}&mode=view&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                            👁️ Просмотр
                          </a>
                          <a href={`https://epotos-ur-intel.vercel.app/editor?version_id=${version.id}&mode=edit&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-white bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-700">
                            ✏️ Редактировать
                          </a>
                        </>
                      )}
                      {(parseInt(user?.id ?? '0') === contract.author_bitrix_id || [30, 1148].includes(parseInt(user?.id ?? '0'))) && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Удалить версию v${version.version_number}?`)) return
                            const filePath = version.file_url.split('/contracts/')[1]
                            await fetch('https://epotos-ur-intel.vercel.app/api/versions', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                version_id: version.id,
                                file_path: filePath,
                                contract_id: contract.id,
                                user_name: user?.name ?? 'Система',
                              }),
                            })
                            window.location.reload()
                          }}
                          className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50">
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Дополнительные материалы */}
              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Дополнительные материалы</h3>
                  <button onClick={() => setShowAttachmentForm(p => !p)}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                    + Добавить
                  </button>
                </div>
                {showAttachmentForm && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Тип</label>
                        <select value={attachmentType} onChange={e => setAttachmentType(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                          {ATTACHMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Название (необязательно)</label>
                        <input value={attachmentTitle} onChange={e => setAttachmentTitle(e.target.value)}
                          placeholder="Например: к договору №..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Комментарий</label>
                      <input value={attachmentComment} onChange={e => setAttachmentComment(e.target.value)}
                        placeholder="Необязательный комментарий"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Файл <span className="text-red-500">*</span></label>
                      <div className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-colors ${attachmentFile ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                        {attachmentFile ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachmentFile.name}</p>
                            <button type="button" onClick={() => setAttachmentFile(null)}
                              className="mt-1 text-xs text-red-500 hover:text-red-700 underline">Удалить</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Нажмите для выбора файла</p>
                        )}
                        {!attachmentFile && (
                          <input type="file" accept=".pdf,.docx,.xlsx"
                            onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUploadAttachment} disabled={uploadingAttachment || !attachmentFile}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                        {uploadingAttachment ? 'Загрузка...' : 'Загрузить'}
                      </button>
                      <button onClick={() => setShowAttachmentForm(false)}
                        className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
                {attachments.length === 0 ? (
                  <p className="text-sm text-gray-400">Дополнительных материалов нет</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {att.attachment_type} №{att.number}
                            {att.title && ` — ${att.title}`}
                          </p>
                          <p className="text-xs text-gray-500">{att.file_name}</p>
                          {att.comment && <p className="text-xs text-gray-400">{att.comment}</p>}
                        </div>
                        <div className="flex gap-2">
                          
                          {(att.file_name.endsWith('.docx') || att.file_name.endsWith('.xlsx')) && (
                            <>
                              <a href={`https://epotos-ur-intel.vercel.app/editor?attachment_id=${att.id}&mode=view&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs text-gray-700 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                                👁️ Просмотр
                              </a>
                              <a href={`https://epotos-ur-intel.vercel.app/editor?attachment_id=${att.id}&mode=edit&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700">
                                ✏️ Редактировать
                              </a>
                            </>
                          )}
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-100">
                            Скачать
                          </a>
                          {(parseInt(user?.id ?? '0') === contract.author_bitrix_id || [30, 1148].includes(parseInt(user?.id ?? '0'))) && (
                            <button onClick={() => handleDeleteAttachment(att.id, att.file_url)}
                              className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Подписанные экземпляры */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Подписанные экземпляры</h2>
                  {canUploadSigned && (
                    <label className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer
                      ${['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus)
                        ? `bg-gray-900 text-white hover:bg-gray-700 ${uploadingSignedFile ? 'opacity-50' : ''}`
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                      title={!['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus) ? 'Доступно после согласования документа' : ''}>
                      {uploadingSignedFile ? 'Загрузка...' : '+ Загрузить подписанный файл'}
                      <input type="file" className="hidden" accept=".pdf,.docx,.xlsx"
                        disabled={uploadingSignedFile || !['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus)}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploadingSignedFile(true)
                          const fd = new FormData()
                          fd.append('file', file)
                          fd.append('contract_id', contract.id)
                          fd.append('user_name', user?.name ?? '')
                          fd.append('user_bitrix_id', user?.id ?? '')
                          fd.append('confirm_all', 'false')
                          const res = await fetch('https://epotos-ur-intel.vercel.app/api/signed-documents', { method: 'POST', body: fd })
                          const data = await res.json()
                          setUploadingSignedFile(false)
                          if (data.error) { alert('Ошибка: ' + data.error); return }
                          const docsRes = await fetch(`https://epotos-ur-intel.vercel.app/api/signed-documents?contract_id=${contract.id}`)
                          const docsData = await docsRes.json()
                          if (docsData.documents) setSignedDocs(docsData.documents)
                          setShowConfirmAllModal(true)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
                {signedDocs.length === 0 ? (
                  <p className="text-sm text-gray-400">Подписанные экземпляры ещё не загружены</p>
                ) : (
                  <div className="space-y-2">
                    {signedDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-3">
                          <span className="text-green-600">✅</span>
                          <div>
                            <p className="text-sm text-gray-900">{doc.file_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleString('ru-RU')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-100">
                            Скачать
                          </a>
                          {(ADMIN_IDS.includes(userId) || GC_MANAGER_IDS.includes(userId)) && (
                            <button
                              onClick={async () => {
                                if (!confirm('Удалить этот файл?')) return
                                const res = await fetch('https://epotos-ur-intel.vercel.app/api/signed-documents', {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: doc.id, file_url: doc.file_url, contract_id: contract.id, user_name: user?.name, user_bitrix_id: user?.id })
                                })
                                const data = await res.json()
                                if (data.error) { alert('Ошибка: ' + data.error); return }
                                setSignedDocs(prev => prev.filter(d => d.id !== doc.id))
                              }}
                              className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {canUploadSigned && contractStatus !== 'подписан' && contractStatus !== 'на_исполнении' && (
                      <button
                        onClick={() => setShowConfirmAllModal(true)}
                        className="mt-2 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                        ✅ Подтвердить — все документы загружены
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Модальное окно подтверждения */}
              {showConfirmAllModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Все подписанные документы загружены?</h3>
                    <p className="text-sm text-gray-600 mb-6">Если все подписанные экземпляры загружены — подтвердите. Статус изменится на «Подписанные документы загружены».<br/><br/>Если загружены не все — нажмите «Ещё не все», система продолжит напоминать.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          const fd = new FormData()
                          fd.append('contract_id', contract.id)
                          fd.append('user_name', user?.name ?? '')
                          fd.append('user_bitrix_id', user?.id ?? '')
                          fd.append('confirm_all', 'true')
                          fd.append('status_only', 'true')
                          await fetch('https://epotos-ur-intel.vercel.app/api/signed-documents', { method: 'POST', body: fd })
                          setShowConfirmAllModal(false)
                          window.location.reload()
                        }}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700">
                        ✅ Все загружены
                      </button>
                      <button
                        onClick={() => setShowConfirmAllModal(false)}
                        className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50">
                        Ещё не все
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Согласование */}
          {activeTab === 'approval' && (
            <div className="p-6">
              {sessionLoading ? (
                <p className="text-sm text-gray-400">Загрузка...</p>
              ) : !hasActiveSession ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Согласование не запущено.</p>
                  <ApproveButton
                    contractId={contract.id}
                    contractStatus={contract.status}
                    authorBitrixId={contract.author_bitrix_id ?? null}
                    allowOthers={contract.allow_others_to_approve ?? false}
                  />
                  <div className="mt-3">
                    <DelegateApproveCheckbox
                      contractId={contract.id}
                      contractNumber={contract.number}
                      authorBitrixId={contract.author_bitrix_id ?? null}
                      allowOthers={contract.allow_others_to_approve ?? false}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Статус и дедлайн */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">Согласование активно</span>
                        {allApproved && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Все согласовали ✓</span>}
                      </div>
                      <p className="text-xs text-gray-500">Инициатор: {session.initiated_by_name}</p>
                      <p className="text-xs text-gray-500">Запущено: {new Date(session.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Дедлайн</p>
                      <p className={`text-sm font-medium ${daysLeft < 2 ? 'text-red-600' : 'text-gray-900'}`}>
                        {new Date(session.deadline).toLocaleDateString('ru-RU')}
                      </p>
                      <p className={`text-xs ${daysLeft < 2 ? 'text-red-500' : 'text-gray-400'}`}>
                        {daysLeft > 0 ? `осталось ${daysLeft} дн.` : 'просрочено'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Чек-лист */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Участники</h3>
                      <div className="space-y-2">
                        {session.approval_participants.map(p => (
                          <div key={p.id} className="flex items-start justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.user_name}</p>
                              <p className="text-xs text-gray-500">{STAGE_LABELS[p.stage] ?? p.stage}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.status]}`}>
                                {STATUS_LABELS[p.status]}
                              </span>
                              {ADMIN_IDS.includes(userId) && p.status === 'pending' && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Удалить участника ${p.user_name} из согласования?`)) return
                                    const res = await fetch(`${baseUrl}/api/approvals/${session.id}/participants`, {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        participant_id: p.id,
                                        admin_name: user?.name,
                                        admin_bitrix_id: user?.id,
                                        contract_id: contract.id,
                                      })
                                    })
                                    const data = await res.json()
                                    if (data.error) { alert('Ошибка: ' + data.error); return }
                                    await loadSession()
                                  }}
                                  className="text-red-400 hover:text-red-600 text-xs border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-50 whitespace-nowrap">
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Прогресс + действие */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Прогресс</h3>
                        {(() => {
                          const required = session.approval_participants.filter(p => p.role === 'required')
                          const done = required.filter(p => ['approved', 'disabled', 'completed_by_initiator'].includes(p.status))
                          const pct = required.length > 0 ? Math.round(done.length / required.length * 100) : 0
                          const optional = session.approval_participants.filter(p => p.role === 'optional')
                          const ackDone = optional.filter(p => ['acknowledged', 'approved'].includes(p.status))
                          const ackPct = optional.length > 0 ? Math.round(ackDone.length / optional.length * 100) : 0
                          return (
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>{done.length} из {required.length} согласовали</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              {optional.length > 0 && (
                                <div>
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{ackDone.length} из {optional.length} ознакомились</span>
                                    <span>{ackPct}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${ackPct}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      {/* Моё действие */}
                      {myParticipant?.status === 'pending' && myParticipant?.role === 'required' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-sm font-medium text-blue-900 mb-3">Требуется ваше решение</p>
                          <button onClick={() => { setApprovingId(myParticipant.id); setShowApproveModal(true) }}
                            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                            ✓ Согласовать документ
                          </button>
                        </div>
                      )}
                      {myParticipant?.status === 'pending' && myParticipant?.role === 'optional' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">Вы добавлены для ознакомления</p>
                          <button onClick={() => { setApprovingId(myParticipant.id); setShowAcknowledgeModal(true) }}
                            className="w-full bg-gray-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
                            👁 Ознакомлен
                          </button>
                        </div>
                      )}

                      {/* Добавить участника */}
                      <button onClick={openAddParticipantModal}
                        className="w-full text-xs border border-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        + Добавить участника
                      </button>

                      {/* Прервать */}
                      <CancelApprovalButton
                        sessionId={session.id}
                        contractId={contract.id}
                        contractNumber={contract.number}
                        initiatedByBitrixId={session.initiated_by_bitrix_id}
                        onCancelled={() => { loadSession() }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EpotosGPT */}
          {activeTab === 'ai' && (
            <div className="p-6">
              <AIAnalysis
                contractId={contract.id}
                versions={versions.map(v => ({
                  id: v.id,
                  file_url: v.file_url,
                  file_name: v.file_name,
                  version_number: v.version_number,
                }))}
                attachments={attachments}
                userName={user?.name}
                userId={user?.id ? parseInt(user.id) : undefined}
                documentType={contract.type}
                documentCategory={contract.document_category ?? 'contract'}
              />
            </div>
          )}

          {/* Генерация */}
          {activeTab === 'generate' && (
            <div className="p-6">
              <AIGenerate
                contractId={contract.id}
                onGenerated={() => {}}
              />
            </div>
          )}

          {/* Чат */}
          {activeTab === 'chat' && (
            <div className="p-6">
              {!hasActiveSession ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">Чат доступен после запуска согласования</p>
                </div>
              ) : (
                <div>
                  {/* Печать чата */}
                  <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden bg-gray-50 rounded-xl p-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">С даты</label>
                      <input type="date" id="chat-date-from"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">По дату</label>
                      <input type="date" id="chat-date-to"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                    </div>
                    <button
                      onClick={() => {
                        const from = (document.getElementById('chat-date-from') as HTMLInputElement)?.value
                        const to = (document.getElementById('chat-date-to') as HTMLInputElement)?.value
                        const printWindow = window.open('', '_blank')
                        if (!printWindow) return
                        let messages = session.approval_messages
                        if (from) messages = messages.filter(m => new Date(m.created_at) >= new Date(from))
                        if (to) {
                          const toDate = new Date(to)
                          toDate.setHours(23, 59, 59, 999)
                          messages = messages.filter(m => new Date(m.created_at) <= toDate)
                        }
                        const periodLabel = from || to
                          ? 'За период: ' + (from ? new Date(from).toLocaleDateString('ru-RU') : '—') + ' — ' + (to ? new Date(to).toLocaleDateString('ru-RU') : '—')
                          : 'Все сообщения'
                        const html = buildChatHtml(contract, messages, periodLabel)
                        printWindow.document.write(html)
                        printWindow.document.close()
                        printWindow.focus()
                        printWindow.print()
                      }}
                      className="text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1">
                      🖨️ Печать за период
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank')
                        if (!printWindow) return
                        const messages = session.approval_messages
                        const html = buildChatHtml(contract, messages, 'Все сообщения')
                        printWindow.document.write(html)
                        printWindow.document.close()
                        printWindow.focus()
                        printWindow.print()
                      }}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 flex items-center gap-1">
                      🖨️ Печать всего чата
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4 pr-1">
                    {session.approval_messages.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Сообщений пока нет</p>
                    ) : session.approval_messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.bitrix_user_id === parseInt(user?.id ?? '0') ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${msg.is_ai ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
                          {msg.is_ai ? 'AI' : msg.author_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`flex-1 ${msg.bitrix_user_id === parseInt(user?.id ?? '0') ? 'items-end' : ''}`}>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-900">{msg.author_name}</span>
                            <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                          </div>
                          {editingMessageId === msg.id ? (
                            <div className="space-y-2">
                              <textarea value={editingMessageText}
                                onChange={e => setEditingMessageText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleEditMessage(msg.id)}
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-none"
                                autoFocus />
                              <div className="flex gap-2">
                                <button onClick={() => handleEditMessage(msg.id)}
                                  className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                                  Сохранить
                                </button>
                                <button onClick={() => setEditingMessageId(null)}
                                  className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600">
                                  Отмена
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative group/msg inline-block">
                              <div className={`text-sm rounded-xl px-3 py-2 inline-block max-w-sm ${
                                msg.bitrix_user_id === parseInt(user?.id ?? '0')
                                  ? 'bg-blue-500 text-white'
                                  : msg.is_ai ? 'bg-purple-50 text-purple-900' : 'bg-gray-100 text-gray-900'
                              }`} style={msg.bitrix_user_id === parseInt(user?.id ?? '0') ? {backgroundColor: '#2563eb', color: '#ffffff', WebkitTextFillColor: '#ffffff'} : {}}>
                                {msg.message && <p>{msg.message}</p>}
                                {msg.file_url && msg.file_type?.startsWith('image/') && (
                                  <img src={msg.file_url} alt={msg.file_name ?? 'изображение'}
                                    className="max-w-xs max-h-48 rounded-lg mt-1 cursor-pointer"
                                    onClick={() => window.open(msg.file_url ?? '', '_blank')} />
                                )}
                                {msg.file_url && !msg.file_type?.startsWith('image/') && (
                                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 mt-1 underline text-xs">
                                    📎 {msg.file_name}
                                  </a>
                                )}
                              </div>
                              <div className="absolute bottom-1 right-1 hidden group-hover/msg:flex gap-0.5 z-10">
                                
                                {msg.bitrix_user_id === parseInt(user?.id ?? '0') && !msg.is_ai && (
                                  <button
                                    onClick={() => { setEditingMessageId(msg.id); setEditingMessageText(msg.message) }}
                                    title="Редактировать"
                                    className="bg-black bg-opacity-25 hover:bg-opacity-40 active:bg-opacity-60 text-white rounded w-5 h-5 flex items-center justify-center transition-all"
                                    style={{fontSize:'10px'}}>
                                    ✏️
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="relative">
                    {showEmojiPicker && (
                      <div className="absolute bottom-14 left-0 z-50">
                        <EmojiPicker
                          onEmojiClick={(emojiData) => {
                            setMessage(prev => prev + emojiData.emoji)
                            setShowEmojiPicker(false)
                          }}
                          width={300}
                          height={350}
                        />
                      </div>
                    )}
                    <div className="flex gap-2 border-t border-gray-100 pt-4">
                      <button onClick={() => setShowEmojiPicker(p => !p)}
                        className="text-xl px-2 py-2 rounded-xl hover:bg-gray-100 transition-colors">
                        😊
                      </button>
                      <button onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="text-xl px-2 py-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50">
                        {uploadingFile ? '⏳' : '📎'}
                      </button>
                      <input ref={fileInputRef} type="file"
                        accept="image/*,.pdf,.docx,.xlsx"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file)
                          e.target.value = ''
                        }} />
                      <input value={message} onChange={e => setMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Написать сообщение..."
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white" />
                      <button onClick={handleSendMessage} disabled={sendingMessage || !message.trim()}
                        className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm hover:bg-gray-700 disabled:opacity-50">
                        {sendingMessage ? '...' : '➤'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modal согласования */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение согласования</h3>
            <p className="text-sm text-gray-600 mb-4">Вы подтверждаете согласование документа <strong>{contract.number}</strong>?</p>
            <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)}
              placeholder="Комментарий (необязательно)..." rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4 resize-none" />
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={approving}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {approving ? 'Сохранение...' : 'Подтвердить согласование'}
              </button>
              <button onClick={() => { setShowApproveModal(false); setApproveComment('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal добавления участника */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить участника</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудник</label>
                {addParticipantOptions.length > 0 ? (
                  <select value={newParticipantName}
                    onChange={e => setNewParticipantName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="">— Выберите сотрудника —</option>
                    {addParticipantOptions.map(p => (
                      <option key={p.id} value={p.user_name}>
                        {p.user_name}{p.department ? ` — ${p.department}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={newParticipantName}
                    onChange={e => setNewParticipantName(e.target.value)}
                    placeholder="ФИО сотрудника"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Роль</label>
                <select value={newParticipantRole}
                  onChange={e => setNewParticipantRole(e.target.value as 'required' | 'optional')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="required">Обязательный</option>
                  <option value="optional">Для информирования</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleAddParticipant} disabled={addingParticipant || !newParticipantName.trim()}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {addingParticipant ? 'Добавление...' : 'Добавить'}
              </button>
              <button onClick={() => { setShowAddParticipantModal(false); setNewParticipantName('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ознакомления */}
      {showAcknowledgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение ознакомления</h3>
            <p className="text-sm text-gray-600 mb-6">Вы подтверждаете что ознакомились с документом <strong>{contract.number}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={handleAcknowledge} disabled={acknowledging}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
                {acknowledging ? 'Сохранение...' : '👁 Подтвердить ознакомление'}
              </button>
              <button onClick={() => setShowAcknowledgeModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
