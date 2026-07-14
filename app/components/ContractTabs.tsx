'use client'
import { buildChatHtml } from '@/utils/chatPrint'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Tooltip from '@/app/components/Tooltip'
import ApproveButton from '@/app/components/ApproveButton'
import DelegateApproveCheckbox from '@/app/components/DelegateApproveCheckbox'
import DeleteContractButton from '@/app/components/DeleteContractButton'
import RelatedDocuments from '@/app/components/RelatedDocuments'
import SignedDocumentUploadModal from '@/app/components/SignedDocumentUploadModal'
import AIAnalysis from '@/app/components/AIAnalysis'
import ExecutionControl from '@/app/components/ExecutionControl'
import StorageConfirm from '@/app/components/StorageConfirm'

const ATTACHMENT_TYPES = [
  'Спецификация',
  'Приложение',
  'Дополнительное соглашение',
  'Протокол разногласий',
  'Акт',
  'Другое',
]
import AIGenerate from '@/app/components/AIGenerate'
import GenerateFromTemplate from '@/app/components/GenerateFromTemplate'
import CancelApprovalButton from '@/app/components/CancelApprovalButton'
import dynamic from 'next/dynamic'
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { useDocumentContext } from '@/app/context/DocumentContext'
import { proxyUrl } from '@/app/utils/proxyUrl'
import { uploadFileDirect } from '@/app/utils/uploadFile'
import { createClient } from '@supabase/supabase-js'
// jsPDF убран — используем HTML print вместо PDF

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
  storage_confirmed_at?: string | null
  storage_confirmed_by_name?: string | null
  signed_by_bitrix_id?: number | null
  signed_file_url?: string | null
  signed_file_name?: string | null
  signed_file_uploaded_at?: string | null
  signed_file_uploaded_by?: string | null
  parent_contract_id?: string | null
  parent_contract_external?: string | null
  is_child?: boolean | null
  customer_number?: string | null
  counterparty_id?: string | null
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
  reply_to_id?: string | null
  reply_to_author?: string | null
  reply_to_text?: string | null
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
  edo_requested?: boolean | null
  edo_requested_by_name?: string | null
  edo_director_bitrix_id?: number | null
  edo_director_name?: string | null
  edo_director_decision?: 'approved' | 'rejected' | null
  signing_method?: 'edo' | 'simple' | null
  signing_method_set_by_name?: string | null
  edo_specialist_name?: string | null
  edo_task_sent_at?: string | null
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
  observing: '👁 Наблюдает',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  disabled: 'bg-gray-100 text-gray-500',
  completed_by_initiator: 'bg-gray-200 text-gray-600',
  observing: 'bg-indigo-100 text-indigo-700',
}

export default function ContractTabs({ contract, versions, logs, userRole, userCompanies }: Props & { userRole?: string, userCompanies?: string[] }) {
  const { user } = useBitrixAuth()
  const { setCurrentDocument } = useDocumentContext()

  useEffect(() => {
    setCurrentDocument({
      id: contract.id,
      number: contract.number ?? '',
      title: contract.title ?? '',
      status: contract.status ?? '',
      companyPrefix: contract.company_prefix ?? undefined,
    })
    return () => setCurrentDocument(null)
  }, [contract.id, contract.status])

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
  // Документы контрагента
  const [cpDocs, setCpDocs] = useState<{id: string, category: string, file_name: string, file_url: string, file_type: string}[]>([])
  const [cpDocsLoading, setCpDocsLoading] = useState(false)
  const [showCpDocsUpload, setShowCpDocsUpload] = useState(false)
  const [cpUploadCategory, setCpUploadCategory] = useState('charter')
  const [cpUploadFile, setCpUploadFile] = useState<File | null>(null)
  const [cpUploading, setCpUploading] = useState(false)

  const cpCategoryLabels: Record<string, string> = {
    charter: '📋 Устав',
    poa: '📜 Доверенность',
    order: '📄 Решение/Приказ',
    other: '📎 Прочее',
  }

  const loadCpDocs = async () => {
    if (!contract.counterparty_id) return
    setCpDocsLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties/${contract.counterparty_id}/documents`)
      const data = await res.json()
      setCpDocs(data.documents ?? [])
    } catch { /* тихо */ }
    finally { setCpDocsLoading(false) }
  }

  const uploadCpDoc = async () => {
    if (!cpUploadFile || !contract.counterparty_id) return
    setCpUploading(true)
    try {
      const { public_url, file_name } = await uploadFileDirect(
        cpUploadFile,
        'counterparty-docs',
        `${contract.counterparty_id}/${cpUploadCategory}`
      )
      const res = await fetch(`${baseUrl}/api/counterparties/${contract.counterparty_id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cpUploadCategory,
          file_name,
          file_url: public_url,
          file_type: cpUploadFile.type,
          uploaded_by_id: user?.id ?? '0',
          uploaded_by_name: user?.name ?? '',
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadCpDocs()
        setShowCpDocsUpload(false)
        setCpUploadFile(null)
        setCpUploadCategory('charter')
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err)
    }
    finally { setCpUploading(false) }
  }

  useEffect(() => {
    if (contract.counterparty_id && activeTab === 'details') {
      loadCpDocs()
    }
  }, [contract.counterparty_id, activeTab])

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
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
  const [revokingParticipantId, setRevokingParticipantId] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  const handleRevokeVote = async () => {
    if (!revokeReason.trim()) { setRevokeError('Укажите причину отмены'); return }
    setRevokeLoading(true)
    setRevokeError('')
    try {
      if (!session) { setRevokeError('Сессия не найдена'); return }
      const res = await fetch(`${baseUrl}/api/approvals/${session.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: revokingParticipantId,
          reason: revokeReason,
          user_bitrix_id: user?.id,
          user_name: user?.name,
          contract_id: contract.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRevokeError(data.error ?? 'Ошибка'); return }
      setRevokingParticipantId(null)
      setRevokeReason('')
      if (contractStatus === 'отклонён') setContractStatus('на_согласовании')
      await loadSession()
    } catch { setRevokeError('Ошибка соединения') }
    finally { setRevokeLoading(false) }
  }
  const [attachments, setAttachments] = useState<{id: string, attachment_type: string, number: number, title: string | null, file_url: string, file_name: string, comment: string | null, created_at: string}[]>([])
  const [signedDocs, setSignedDocs] = useState<{id: string; file_url: string; file_name: string; uploaded_by_name: string; created_at: string; has_discrepancies?: boolean; discrepancy_comment?: string}[]>([])
  const [showSignedModal, setShowSignedModal] = useState(false)
  const [signedFileOptions, setSignedFileOptions] = useState<{id: string; file_name: string; type: 'version' | 'attachment'; version_number?: number}[]>([])
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
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author_name: string; message: string } | null>(null)

  // ЭДО
  const [edoSpecialists, setEdoSpecialists] = useState<{bitrix_user_id: number, user_name: string, position: string}[]>([])
  const [edoDirectors, setEdoDirectors] = useState<{bitrix_user_id: number, user_name: string}[]>([])
  const [selectedEdoDirectorId, setSelectedEdoDirectorId] = useState<number | null>(null)
  const [selectedEdoSpecialistId, setSelectedEdoSpecialistId] = useState<number | null>(null)
  const [edoLoading, setEdoLoading] = useState(false)
  const [edoError, setEdoError] = useState('')
  const [edoSuccess, setEdoSuccess] = useState('')

  useEffect(() => {
    if (!contract.company_prefix) return
    Promise.all([
      fetch(`${baseUrl}/api/edo-specialists?company_prefix=${contract.company_prefix}`).then(r => r.json()),
      fetch(`${baseUrl}/api/approval-settings?stage=director&company=${contract.company_prefix}`).then(r => r.json()),
    ]).then(([edoData, dirData]) => {
      setEdoSpecialists(edoData.specialists ?? [])
      const dirs = (dirData.participants ?? []).map((p: {bitrix_user_id: number, user_name: string}) => ({
        bitrix_user_id: p.bitrix_user_id,
        user_name: p.user_name,
      }))
      setEdoDirectors(dirs)
      if (dirs.length > 0) setSelectedEdoDirectorId(dirs[0].bitrix_user_id)
    })
  }, [contract.company_prefix])

  const handleDeleteMessage = async (messageId: string) => {
    if (!session) return
    await fetch(`${baseUrl}/api/approvals/${session.id}/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageId,
        bitrix_user_id: user?.id ? parseInt(user.id) : null,
      }),
    })
    setSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        approval_messages: prev.approval_messages.filter(m => m.id !== messageId),
      }
    })
  }

  const handleEdoRequest = async () => {
    if (!session || !selectedEdoDirectorId) return
    setEdoLoading(true); setEdoError(''); setEdoSuccess('')
    const director = edoDirectors.find(d => d.bitrix_user_id === selectedEdoDirectorId)
    const res = await fetch(`${baseUrl}/api/approvals/${session.id}/edo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request',
        bitrix_user_id: userId,
        user_name: user?.name ?? '',
        edo_director_bitrix_id: selectedEdoDirectorId,
        edo_director_name: director?.user_name ?? '',
        contract_id: contract.id,
        contract_number: contract.number,
      }),
    })
    const data = await res.json()
    if (data.success) { setEdoSuccess('Запрос отправлен'); await loadSession() }
    else setEdoError(data.error ?? 'Ошибка')
    setEdoLoading(false)
  }

  const handleEdoDecision = async (decision: 'approved' | 'rejected') => {
    if (!session) return
    setEdoLoading(true); setEdoError(''); setEdoSuccess('')
    const res = await fetch(`${baseUrl}/api/approvals/${session.id}/edo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'director_decision',
        decision,
        bitrix_user_id: userId,
        user_name: user?.name ?? '',
        contract_id: contract.id,
        contract_number: contract.number,
      }),
    })
    const data = await res.json()
    if (data.success) { setEdoSuccess(decision === 'approved' ? 'ЭДО разрешено' : 'ЭДО отклонено'); await loadSession() }
    else setEdoError(data.error ?? 'Ошибка')
    setEdoLoading(false)
  }

  const handleEdoSendTask = async (method: 'edo' | 'simple') => {
    if (!session) return
    setEdoLoading(true); setEdoError(''); setEdoSuccess('')
    const specialist = edoSpecialists.find(s => s.bitrix_user_id === selectedEdoSpecialistId)
    const res = await fetch(`${baseUrl}/api/approvals/${session.id}/edo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_method',
        method,
        bitrix_user_id: userId,
        user_name: user?.name ?? '',
        edo_specialist_bitrix_id: method === 'edo' ? selectedEdoSpecialistId : null,
        edo_specialist_name: method === 'edo' ? (specialist?.user_name ?? '') : null,
        contract_id: contract.id,
        contract_number: contract.number,
      }),
    })
    const data = await res.json()
    if (data.success) { setEdoSuccess(method === 'edo' ? 'Задание отправлено специалисту ЭДО' : 'Выбрана простая подпись'); await loadSession() }
    else setEdoError(data.error ?? 'Ошибка')
    setEdoLoading(false)
  }

  const canDeleteMessage = (msg: Message): boolean => {
    const userId = user?.id ? parseInt(user.id) : null
    if (!userId || msg.bitrix_user_id !== userId) return false
    const msgs = session?.approval_messages ?? []
    const lastMsg = [...msgs].reverse().find(m => !m.is_ai)
    if (!lastMsg || lastMsg.id !== msg.id) return false
    const afterMine = msgs.filter(m =>
      m.id !== msg.id &&
      m.bitrix_user_id !== userId &&
      new Date(m.created_at) > new Date(msg.created_at)
    )
    if (afterMine.length > 0) return false
    const diffMin = (Date.now() - new Date(msg.created_at).getTime()) / 60000
    return diffMin <= 5
  }
  const [newParticipantName, setNewParticipantName] = useState('')
  const [newParticipantRole, setNewParticipantRole] = useState<'required' | 'optional' | 'observer'>('required')
  const [participantFilter, setParticipantFilter] = useState<'all' | 'required' | 'optional' | 'observer'>('all')

  const [showChangeNumberModal, setShowChangeNumberModal] = useState(false)
  const [newDocNumber, setNewDocNumber] = useState('')
  const [changeNumberComment, setChangeNumberComment] = useState('')
  const [changeNumberSaving, setChangeNumberSaving] = useState(false)
  const [changeNumberError, setChangeNumberError] = useState('')
  const [canChangeNumber, setCanChangeNumber] = useState(false)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addParticipantOptions, setAddParticipantOptions] = useState<{id: string, user_name: string, bitrix_user_id: number, department: string | null}[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [contractStatus, setContractStatus] = useState(contract.status)
  const [approving, setApproving] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string>('user')
  const [currentUserCompanies, setCurrentUserCompanies] = useState<string[]>([])

  // Inline edit реквизитов
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    title: contract.title ?? '',
    counterparty: contract.counterparty ?? '',
    amount: contract.amount ? String(contract.amount) : '',
    start_date: contract.start_date ?? '',
    end_date: contract.end_date ?? '',
    customer_number: contract.customer_number ?? '',
  })
  const [savingField, setSavingField] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [counterpartySearchEdit, setCounterpartySearchEdit] = useState('')
  const [counterpartySuggestionsEdit, setCounterpartySuggestionsEdit] = useState<{id: string, short_name: string | null, full_name: string, inn: string}[]>([])
  const [counterpartySearchLoadingEdit, setCounterpartySearchLoadingEdit] = useState(false)
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null)

  const searchCounterpartiesEdit = async (q: string) => {
    if (q.length < 2) { setCounterpartySuggestionsEdit([]); return }
    setCounterpartySearchLoadingEdit(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties?search=${encodeURIComponent(q)}`)
      const data = await res.json()
      setCounterpartySuggestionsEdit(data.counterparties ?? [])
    } finally {
      setCounterpartySearchLoadingEdit(false)
    }
  }

  const LOCKED_STATUSES = ['согласован', 'на_подписи_в_эдо', 'загружен_частично', 'подписан', 'на_исполнении']

  useEffect(() => {
    if (!user?.id) { setCanChangeNumber(false); return }
    const uid = parseInt(user.id)
    if (ADMIN_IDS.includes(uid)) { setCanChangeNumber(true); return }
    if (LOCKED_STATUSES.includes(contractStatus)) { setCanChangeNumber(false); return }
    if (contract.author_bitrix_id === uid) { setCanChangeNumber(true); return }
    if (session?.initiated_by_bitrix_id === uid) { setCanChangeNumber(true); return }
    const isLegalParticipant = session?.approval_participants?.some(
      p => p.bitrix_user_id === uid && ['legal', 'legal_gc'].includes(p.stage)
    )
    setCanChangeNumber(!!isLegalParticipant)
  }, [user?.id, contractStatus, session, contract.author_bitrix_id])

  const handleChangeNumber = async () => {
    if (!newDocNumber.trim() || !changeNumberComment.trim()) {
      setChangeNumberError('Укажите новый номер и причину изменения')
      return
    }
    setChangeNumberSaving(true)
    setChangeNumberError('')
    try {
      const res = await fetch(`${baseUrl}/api/contracts/${contract.id}/change-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_number: newDocNumber,
          comment: changeNumberComment,
          user_name: user?.name ?? 'Система',
          user_bitrix_id: user?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setChangeNumberError(data.error ?? 'Ошибка сохранения')
        return
      }
      window.location.reload()
    } catch {
      setChangeNumberError('Ошибка соединения')
    } finally {
      setChangeNumberSaving(false)
    }
  }
  const isLocked = LOCKED_STATUSES.includes(contractStatus)
  const CAN_EDIT_ROLES = ['admin', 'developer', 'gc_manager', 'legal_gc', 'legal']
  const canEditDetails = !isLocked && (
    CAN_EDIT_ROLES.includes(currentUserRole) ||
    parseInt(user?.id ?? '0') === contract.author_bitrix_id
  )

  const saveField = async (field: string, value: string) => {
    setSavingField(true)
    setSaveError('')
    const oldValue = (contract as unknown as Record<string, unknown>)[field]
    const res = await fetch(`${baseUrl}/api/contracts/${contract.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field,
        value,
        user_name: user?.name ?? 'Пользователь',
        old_value: oldValue,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setEditingField(null)
    } else {
      setSaveError(data.error ?? 'Ошибка сохранения')
    }
    setSavingField(false)
  }
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    fetch(`${baseUrl}/api/user-role?bitrix_user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        setCurrentUserRole(data.role ?? 'user')
        setCurrentUserCompanies(data.companies ?? [])
      })
  }, [user])

  const openSignedModal = async () => {
    // Собираем список файлов для сравнения (версии + доп. материалы)
    const options: {id: string; file_name: string; type: 'version' | 'attachment'; version_number?: number}[] = []
    versions.forEach(v => {
      if (v.file_name?.endsWith('.docx') || v.file_name?.endsWith('.pdf')) {
        options.push({ id: v.id, file_name: v.file_name, type: 'version', version_number: v.version_number })
      }
    })
    attachments.forEach(a => {
      if (a.file_name?.endsWith('.docx') || a.file_name?.endsWith('.pdf')) {
        options.push({ id: a.id, file_name: a.file_name, type: 'attachment' })
      }
    })
    setSignedFileOptions(options)
    setShowSignedModal(true)
  }

  const loadAttachments = async () => {
    const res = await fetch(`${baseUrl}/api/attachments?contract_id=${contract.id}`)
    const data = await res.json()
    setAttachments(data.attachments ?? [])
  }

  const handleUploadAttachment = async () => {
    if (!attachmentFile) return
    setUploadingAttachment(true)

    try {
      // Загружаем файл напрямую в Supabase минуя Vercel
      const { public_url, file_name } = await uploadFileDirect(
        attachmentFile,
        'contracts',
        `attachments/${contract.id}`
      )

      // Сохраняем метаданные через API
      const res = await fetch(`${baseUrl}/api/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: public_url,
          file_name,
          file_type: attachmentFile.type,
          contract_id: contract.id,
          attachment_type: attachmentType,
          title: attachmentTitle,
          comment: attachmentComment,
          user_name: user?.name ?? 'Система',
          user_bitrix_id: user?.id ?? '',
        }),
      })
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
    } catch (err) {
      alert('Ошибка загрузки: ' + (err instanceof Error ? err.message : 'неизвестная ошибка'))
    } finally {
      setUploadingAttachment(false)
    }
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

  // Realtime подписка на изменения статуса контракта
  useEffect(() => {
    const channel = supabaseClient
      .channel(`contract-status-${contract.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contracts',
        filter: `id=eq.${contract.id}`,
      }, (payload: { new: { status?: string } }) => {
        if (payload.new && payload.new.status) {
          setContractStatus(payload.new.status)
        }
      })
      .subscribe()
    return () => { supabaseClient.removeChannel(channel) }
  }, [contract.id])

  useEffect(() => {
    if (activeTab === 'details' || activeTab === 'chat') {
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

    const addRes = await fetch(`https://epotos-ur-intel.vercel.app/api/approvals/${session.id}/participants`, {
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
    const addData = await addRes.json()
    setAddingParticipant(false)

    if (!addRes.ok || addData.error) {
      alert('Ошибка: ' + (addData.error ?? 'не удалось добавить участника'))
      return
    }

    setShowAddParticipantModal(false)
    setNewParticipantName('')
    setNewParticipantRole('required')
    await loadSession()
    if (addData.success) {
      setContractStatus('на_согласовании')
    }
  }

  const openAddParticipantModal = async () => {
    // Определяем компанию из номера договора
    // Э-К имеет двойной префикс, поэтому используем company_prefix если есть
    const companyPrefix = contract.company_prefix ?? (
      contract.number.startsWith('Э-К') ? 'Э-К' : contract.number.split('-')[0]
    )
    
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
    const res = await fetch(`${baseUrl}/api/approvals/${session.id}/messages`, {
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
    if (res.ok) {
      // Обновляем сообщение локально сразу — без перезагрузки всего чата
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          approval_messages: prev.approval_messages.map(m =>
            m.id === messageId
              ? { ...m, message: editingMessageText.trim() + ' (изм.)' }
              : m
          )
        }
      })
    }
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
      const cleanChatFileName = safeFileName.replace(/[^a-zA-Z0-9._\-]/g, '_')
      const filePath = `chat/${session.id}/${Date.now()}_${cleanChatFileName}`

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
        reply_to_id: replyTo?.id ?? null,
        reply_to_author: replyTo?.author_name ?? null,
        reply_to_text: replyTo ? replyTo.message.slice(0, 100) : null,
      }),
    })
    setMessage('')
    setReplyTo(null)
    setSendingMessage(false)
    if (messageInputRef.current) messageInputRef.current.style.height = '40px'
  }

  const handleApprove = async () => {
    if (!session || !approvingId) return
    setApproving(true)
    const approveRes = await fetch(`${baseUrl}/api/approvals/${session.id}/approve`, {
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
    const approveData = await approveRes.json()
    setShowApproveModal(false)
    setApproveComment('')
    setApprovingId(null)
    setApproving(false)
    await loadSession()
    if (approveData.all_approved) {
      setContractStatus('согласован')
    }
  }

  const handleReject = async () => {
    if (!approvingId) return
    setRejecting(true)
    try {
      const res = await fetch(`${baseUrl}/api/approvals/${session?.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: approvingId,
          comment: rejectComment,
          user_name: user?.name ?? 'Система',
          contract_id: contract.id,
          is_rejected: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowRejectModal(false)
        setRejectComment('')
        setContractStatus('отклонён')
        loadSession()
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setRejecting(false)
    }
  }

  const handleAcknowledge = async () => {
    if (!session || !approvingId) return
    setAcknowledging(true)
    const ackRes = await fetch(`${baseUrl}/api/approvals/${session.id}/approve`, {
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
    const ackData = await ackRes.json()
    setShowAcknowledgeModal(false)
    setApprovingId(null)
    setAcknowledging(false)
    await loadSession()
    if (ackData.all_approved) {
      setContractStatus('согласован')
    }
  }

  const hasActiveSession = session && ['active', 'completed', 'cancelled'].includes(session.status)
  const isSessionActive = session?.status === 'active'
  const allRequired = session?.approval_participants.filter(p => p.role === 'required') ?? []
  const allApproved = allRequired.every(p => ['approved', 'disabled', 'completed_by_initiator'].includes(p.status))
  const daysLeft = session ? Math.ceil((new Date(session.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  const TABS = [
    { id: 'details', label: 'Реквизиты/Чат', icon: '📋', dot: hasActiveSession, badge: unreadCount },
    { id: 'generate', label: 'Генерация', icon: '✨' },
    { id: 'documents', label: 'Документы', icon: '📁' },
    { id: 'approval', label: 'Согласование', icon: '✅' },
    { id: 'ai', label: 'EpotosGPT', icon: '🤖' },
    { id: 'execution', label: 'Контроль исполнения', icon: '📋' },
    { id: 'storage', label: 'Хранение', icon: '📦' },
    { id: 'related', label: 'Связанные документы', icon: '🔗' },
    { id: 'history', label: 'История', icon: '📜' },
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
            {canChangeNumber && (
              <button onClick={() => { setNewDocNumber(contract.number); setShowChangeNumberModal(true) }}
                className="text-gray-300 hover:text-gray-600 text-sm" title="Изменить номер документа">
                ✏️
              </button>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[contractStatus] ?? 'bg-gray-100 text-gray-700'}`}>
              {statusLabel[contractStatus] ?? contractStatus}
            </span>
          </div>
          <DeleteContractButton
            contractId={contract.id}
            contractNumber={contract.number}
            contractCompanyPrefix={contract.company_prefix ?? ''}
            authorBitrixId={contract.author_bitrix_id}
            userRole={currentUserRole}
            userCompanies={currentUserCompanies}
          />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Реквизиты документа</h2>
                    {isLocked && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">🔒 Редактирование заблокировано</span>}
                  </div>
                  {saveError && <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{saveError}</div>}
                  <div className="space-y-3">
                    {/* Название */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Название</span>
                      {editingField === 'title' ? (
                        <div className="flex-1 flex gap-2">
                          <input value={editValues.title} onChange={e => setEditValues(p => ({...p, title: e.target.value}))}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <button onClick={() => saveField('title', editValues.title)} disabled={savingField}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                            {savingField ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.title || '—'}</span>
                          {canEditDetails && <button onClick={() => setEditingField('title')} className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>}
                        </div>
                      )}
                    </div>
                    {/* Контрагент */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Контрагент</span>
                      {editingField === 'counterparty' ? (
                        <div className="flex-1 space-y-1">
                          <div className="relative">
                            <input
                              value={counterpartySearchEdit}
                              onChange={e => { setCounterpartySearchEdit(e.target.value); setEditValues(p => ({...p, counterparty: e.target.value})); searchCounterpartiesEdit(e.target.value) }}
                              placeholder="Поиск контрагента..."
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            {counterpartySearchLoadingEdit && <p className="text-xs text-gray-400 mt-0.5">Поиск...</p>}
                            {counterpartySuggestionsEdit.length > 0 && (
                              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                {counterpartySuggestionsEdit.map(c => (
                                  <button key={c.id} type="button"
                                    onClick={() => {
                                      const name = c.short_name ?? c.full_name
                                      setEditValues(p => ({...p, counterparty: name}))
                                      setCounterpartySearchEdit(name)
                                      setSelectedCounterpartyId(c.id)
                                      setCounterpartySuggestionsEdit([])
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                    <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                                    <p className="text-xs text-gray-500">ИНН: {c.inn}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveField('counterparty', editValues.counterparty)} disabled={savingField}
                              className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                              {savingField ? '...' : '✓ Сохранить'}
                            </button>
                            <button onClick={() => { setEditingField(null); setCounterpartySuggestionsEdit([]); setCounterpartySearchEdit('') }}
                              className="text-xs text-gray-400 hover:text-gray-600">Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.counterparty || '—'}</span>
                          {canEditDetails && (
                            <button onClick={() => { setEditingField('counterparty'); setCounterpartySearchEdit(editValues.counterparty) }}
                              className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Тип — только просмотр */}
                    <div className="flex gap-4">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Тип</span>
                      <span className="text-sm text-gray-900">{contract.type ?? '—'}</span>
                    </div>

                    {/* Документы контрагента */}
                    {contract.counterparty_id && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Документы контрагента</span>
                          <div className="flex items-center gap-2">
                            <a href={`/counterparties/${contract.counterparty_id}`}
                              className="text-xs text-gray-400 hover:text-gray-600">→ Карточка</a>
                            <button onClick={() => setShowCpDocsUpload(p => !p)}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                              {showCpDocsUpload ? '✕ Закрыть' : '+ Загрузить'}
                            </button>
                          </div>
                        </div>

                        {cpDocsLoading && <p className="text-xs text-gray-400">Загрузка...</p>}

                        {/* Форма загрузки */}
                        {showCpDocsUpload && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                            <select value={cpUploadCategory}
                              onChange={e => setCpUploadCategory(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                              <option value="charter">📋 Устав</option>
                              <option value="poa">📜 Доверенность</option>
                              <option value="order">📄 Решение/Приказ</option>
                              <option value="other">📎 Прочее</option>
                            </select>
                            <input type="file" accept=".pdf,.docx,.xlsx,.jpg,.png"
                              onChange={e => setCpUploadFile(e.target.files?.[0] ?? null)}
                              className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300" />
                            <button onClick={uploadCpDoc} disabled={!cpUploadFile || cpUploading}
                              className="w-full bg-gray-900 text-white text-xs py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                              {cpUploading ? 'Загрузка...' : 'Загрузить'}
                            </button>
                          </div>
                        )}

                        {/* Список документов */}
                        {!cpDocsLoading && (
                          <div className="space-y-1">
                            {Object.keys(cpCategoryLabels).map(cat => {
                              const docs = cpDocs.filter(d => d.category === cat)
                              return (
                                <div key={cat} className="flex items-center justify-between py-1">
                                  <span className="text-xs text-gray-500">{cpCategoryLabels[cat]}</span>
                                  {docs.length === 0 ? (
                                    <span className="text-xs text-gray-300">не загружен</span>
                                  ) : (
                                    <div className="flex gap-1">
                                      {docs.map(doc => (
                                        <a key={doc.id} href={proxyUrl(doc.file_url)} target="_blank" rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline px-1.5 py-0.5 bg-blue-50 rounded">
                                          👁 Открыть
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Сумма */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Сумма</span>
                      {editingField === 'amount' ? (
                        <div className="flex-1 flex gap-2">
                          <input type="number" value={editValues.amount} onChange={e => setEditValues(p => ({...p, amount: e.target.value}))}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <button onClick={() => saveField('amount', editValues.amount)} disabled={savingField}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                            {savingField ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.amount ? Number(editValues.amount).toLocaleString('ru-RU') + ' ₽' : '—'}</span>
                          {canEditDetails && <button onClick={() => setEditingField('amount')} className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>}
                        </div>
                      )}
                    </div>
                    {/* Дата начала */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Дата начала</span>
                      {editingField === 'start_date' ? (
                        <div className="flex-1 flex gap-2">
                          <input type="date" value={editValues.start_date} onChange={e => setEditValues(p => ({...p, start_date: e.target.value}))}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <button onClick={() => saveField('start_date', editValues.start_date)} disabled={savingField}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                            {savingField ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.start_date || '—'}</span>
                          {canEditDetails && <button onClick={() => setEditingField('start_date')} className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>}
                        </div>
                      )}
                    </div>
                    {/* Дата окончания */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Дата окончания</span>
                      {editingField === 'end_date' ? (
                        <div className="flex-1 flex gap-2">
                          <input type="date" value={editValues.end_date} onChange={e => setEditValues(p => ({...p, end_date: e.target.value}))}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <button onClick={() => saveField('end_date', editValues.end_date)} disabled={savingField}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                            {savingField ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.end_date || '—'}</span>
                          {canEditDetails && <button onClick={() => setEditingField('end_date')} className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>}
                        </div>
                      )}
                    </div>
                    {/* Номер заказчика */}
                    <div className="flex gap-4 items-start">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">Номер заказчика</span>
                      {editingField === 'customer_number' ? (
                        <div className="flex-1 flex gap-2">
                          <input value={editValues.customer_number} onChange={e => setEditValues(p => ({...p, customer_number: e.target.value}))}
                            placeholder="Номер со стороны заказчика"
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <button onClick={() => saveField('customer_number', editValues.customer_number)} disabled={savingField}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                            {savingField ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm text-gray-900">{editValues.customer_number || '—'}</span>
                          {!isLocked && <button onClick={() => setEditingField('customer_number')} className="text-gray-300 hover:text-gray-600 text-xs">✏️</button>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col h-full">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Чат согласования</h2>
                  {!hasActiveSession ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-gray-400 text-center">Чат доступен после запуска согласования</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Печать чата */}
                      <div className="flex flex-wrap items-end gap-2 mb-3 print:hidden bg-gray-50 rounded-xl p-2">
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
                          className="text-xs border border-gray-200 bg-white px-2 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1">
                          🖨️ За период
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
                          className="text-xs bg-gray-900 text-white px-2 py-1.5 rounded-lg hover:bg-gray-700 flex items-center gap-1">
                          🖨️ Весь чат
                        </button>
                      </div>
                      <div className="space-y-3 max-h-80 overflow-y-auto mb-3 pr-1">
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
                                <div className="relative group/msg inline-block max-w-sm">
                                  {msg.reply_to_id && (
                                    <div className={`text-xs rounded-t-xl px-3 py-1.5 border-l-2 border-blue-400 mb-0.5 ${
                                      msg.bitrix_user_id === parseInt(user?.id ?? '0')
                                        ? 'bg-blue-600 text-blue-100'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      <span className="font-bold text-blue-300">{msg.reply_to_author}</span>
                                      <p className="truncate opacity-80">{msg.reply_to_text}</p>
                                    </div>
                                  )}
                                  <div className={`text-sm rounded-xl px-3 py-2 inline-block w-full ${
                                    msg.reply_to_id ? 'rounded-tl-none' : ''
                                  } ${
                                    msg.bitrix_user_id === parseInt(user?.id ?? '0')
                                      ? 'bg-blue-500 text-white'
                                      : msg.is_ai ? 'bg-purple-50 text-purple-900' : 'bg-gray-100 text-gray-900'
                                  }`} style={msg.bitrix_user_id === parseInt(user?.id ?? '0') ? {backgroundColor: '#2563eb', color: '#ffffff', WebkitTextFillColor: '#ffffff'} : {}}>
                                    {msg.message && <p>{msg.message}</p>}
                                    {msg.file_url && msg.file_type?.startsWith('image/') && (
                                      <img src={proxyUrl(msg.file_url)} alt={msg.file_name ?? 'изображение'}
                                        className="max-w-xs max-h-48 rounded-lg mt-1 cursor-pointer"
                                        onClick={() => window.open(proxyUrl(msg.file_url), '_blank')} />
                                    )}
                                    {msg.file_url && !msg.file_type?.startsWith('image/') && (
                                      <a href={proxyUrl(msg.file_url)} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 mt-1 underline text-xs">
                                        📎 {msg.file_name}
                                      </a>
                                    )}
                                  </div>
                                  <div className="absolute -top-1 right-1 hidden group-hover/msg:flex gap-0.5 z-10">
                                    {!msg.is_ai && (
                                      <button
                                        onClick={() => setReplyTo({ id: msg.id, author_name: msg.author_name, message: msg.message })}
                                        title="Ответить"
                                        className="bg-black bg-opacity-25 hover:bg-opacity-40 text-white rounded w-5 h-5 flex items-center justify-center transition-all"
                                        style={{fontSize:'10px'}}>
                                        ↩
                                      </button>
                                    )}
                                    {msg.bitrix_user_id === parseInt(user?.id ?? '0') && !msg.is_ai && (
                                      <button
                                        onClick={() => { setEditingMessageId(msg.id); setEditingMessageText(msg.message) }}
                                        title="Редактировать"
                                        className="bg-black bg-opacity-25 hover:bg-opacity-40 text-white rounded w-5 h-5 flex items-center justify-center transition-all"
                                        style={{fontSize:'10px'}}>
                                        ✏️
                                      </button>
                                    )}
                                    {canDeleteMessage(msg) && (
                                      <button
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        title="Удалить"
                                        className="bg-red-500 bg-opacity-70 hover:bg-opacity-90 text-white rounded w-5 h-5 flex items-center justify-center transition-all"
                                        style={{fontSize:'10px'}}>
                                        🗑
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
                        {replyTo && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-blue-700">{replyTo.author_name}</p>
                              <p className="text-xs text-blue-500 truncate">{replyTo.message.slice(0, 80)}</p>
                            </div>
                            <button onClick={() => setReplyTo(null)}
                              className="text-blue-400 hover:text-blue-700 ml-2 text-sm font-bold flex-shrink-0">✕</button>
                          </div>
                        )}
                        <div className="flex gap-2 border-t border-gray-100 pt-3">
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
                          <textarea ref={messageInputRef} value={message}
                            onChange={e => {
                              setMessage(e.target.value)
                              e.target.style.height = 'auto'
                              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendMessage()
                              }
                            }}
                            placeholder="Написать сообщение..."
                            rows={1}
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-none overflow-y-auto"
                            style={{ minHeight: '40px', maxHeight: '120px' }} />
                          <button onClick={handleSendMessage} disabled={sendingMessage || !message.trim()}
                            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm hover:bg-gray-700 disabled:opacity-50">
                            {sendingMessage ? '...' : '➤'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                  {!['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus) && (
                    <Link href={`/contracts/${contract.id}/upload`}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                      + Загрузить версию
                    </Link>
                  )}
                  
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
                    <div className="flex flex-wrap gap-2">
                      <a href={proxyUrl(version.file_url)} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                        Скачать
                      </a>
                      {version.file_name.endsWith('.pdf') && (
                        <a href={proxyUrl(version.file_url)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                          👁️ Просмотр
                        </a>
                      )}
                      {(version.file_name.endsWith('.docx') || version.file_name.endsWith('.xlsx')) && (
                        <>
                          <a href={`https://epotos-ur-intel.vercel.app/editor?version_id=${version.id}&mode=view&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                            👁️ Просмотр
                          </a>
                          {!isLocked && (
                            <a href={`https://epotos-ur-intel.vercel.app/editor?version_id=${version.id}&mode=edit&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs text-white bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-700">
                              ✏️ Редактировать
                            </a>
                          )}
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
                  {!['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus) && (
                    <button onClick={() => setShowAttachmentForm(p => !p)}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                      + Добавить
                    </button>
                  )}
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
                              {!isLocked && (
                                <a href={`https://epotos-ur-intel.vercel.app/editor?attachment_id=${att.id}&mode=edit&user_id=${user?.id ?? ''}&user_name=${encodeURIComponent(user?.name ?? '')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700">
                                  ✏️ Редактировать
                                </a>
                              )}
                            </>
                          )}
                          {att.file_name?.endsWith('.pdf') && (
                            <a href={proxyUrl(att.file_url)} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-gray-700 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                              👁️ Просмотр
                            </a>
                          )}
                          <a href={proxyUrl(att.file_url)} target="_blank" rel="noopener noreferrer"
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
                    <button
                      onClick={() => ['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus) ? openSignedModal() : null}
                      disabled={!['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus)}
                      title={!['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus) ? 'Доступно после согласования документа' : ''}
                      className={`text-xs px-3 py-1.5 rounded-lg
                        ${['согласован','загружен_частично','подписан','на_исполнении'].includes(contractStatus)
                          ? 'bg-gray-900 text-white hover:bg-gray-700 cursor-pointer'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      + Загрузить подписанный файл
                    </button>
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
                          <a href={proxyUrl(doc.file_url)} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-700 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                            👁️ Просмотр
                          </a>
                          <a href={proxyUrl(doc.file_url)} download={doc.file_name} target="_blank" rel="noopener noreferrer"
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
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => setShowConfirmAllModal(true)}
                          className="text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                          ✅ Подтвердить — все документы загружены
                        </button>
                        <Tooltip text="Нажмите, когда все нужные подписанные экземпляры уже загружены выше. Документ перейдёт в статус «Подписан», после чего станет доступна генерация чек-листа контроля исполнения." />
                      </div>
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
                          const res = await fetch('https://epotos-ur-intel.vercel.app/api/signed-documents', { method: 'POST', body: fd })
                          const data = await res.json()
                          if (!res.ok || data.error) {
                            alert('Ошибка: ' + (data.error ?? 'не удалось обновить статус'))
                            return
                          }
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Чек-лист */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Участники</h3>
                      <div className="flex gap-1.5 mb-3 flex-wrap">
                        {([
                          { id: 'all', label: 'Все' },
                          { id: 'required', label: 'Обязательные' },
                          { id: 'optional', label: 'Для информирования' },
                          { id: 'observer', label: 'Наблюдатели' },
                        ] as const).map(f => (
                          <button key={f.id} onClick={() => setParticipantFilter(f.id)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${participantFilter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {session.approval_participants.filter(p => participantFilter === 'all' || p.role === participantFilter).map(p => (
                          <div key={p.id} className={`flex items-start justify-between p-2 rounded-lg ${p.role === 'observer' ? 'bg-indigo-50' : p.role === 'optional' ? 'bg-blue-50' : 'bg-green-50'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium text-gray-900">{p.user_name}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${p.role === 'observer' ? 'bg-indigo-100 text-indigo-700' : p.role === 'optional' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                  {p.role === 'observer' ? 'наблюдает' : p.role === 'optional' ? 'ознакамл.' : 'согласует'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{STAGE_LABELS[p.stage] ?? p.stage}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.status]}`}>
                                {STATUS_LABELS[p.status]}
                              </span>
                              {/* Кнопка удаления участника (только admin, только pending) */}
                              {ADMIN_IDS.includes(userId) && ['pending', 'observing'].includes(p.status) && (
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
                                    if (data.all_approved) {
                                      setContractStatus('согласован')
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-600 text-xs border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-50 whitespace-nowrap">
                                  ✕
                                </button>
                              )}
                              {/* Кнопка отмены голоса: ГД — своего, admin — любого со статусом approved/rejected */}
                              {p.role === 'required' && ['approved', 'rejected'].includes(p.status) && (
                                (ADMIN_IDS.includes(userId) || parseInt(user?.id ?? '0') === p.bitrix_user_id) && (
                                  <button
                                    onClick={() => { setRevokingParticipantId(p.id); setRevokeReason(''); setRevokeError('') }}
                                    className="text-orange-400 hover:text-orange-600 text-xs border border-orange-200 px-1.5 py-0.5 rounded hover:bg-orange-50 whitespace-nowrap">
                                    ↩ Отменить
                                  </button>
                                )
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
                      {!isSessionActive && session?.status === 'cancelled' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <p className="text-sm font-medium text-red-800">❌ Документ отклонён</p>
                          <p className="text-xs text-red-600 mt-1">Согласование остановлено. Отклонивший участник может отменить своё решение кнопкой «↩ Отменить» ниже — это вернёт документ в работу.</p>
                        </div>
                      )}
                      {isSessionActive && myParticipant?.status === 'pending' && myParticipant?.role === 'required' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-sm font-medium text-blue-900 mb-3">Требуется ваше решение</p>
                          <button onClick={() => { setApprovingId(myParticipant.id); setShowApproveModal(true) }}
                            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                            ✓ Согласовать документ
                          </button>
                          <button onClick={() => { setApprovingId(myParticipant.id); setShowRejectModal(true) }}
                            className="w-full mt-2 bg-red-50 border border-red-200 text-red-700 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
                            ✕ Отклонить документ
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

                      {/* Лист согласования */}
                      <button
                        onClick={() => {
                          const participants = session.approval_participants ?? []
                          const statusMap: Record<string, string> = {
                            approved: '✅ Согласован', rejected: '❌ Отклонён',
                            pending: '⏳ Ожидает', acknowledged: '👁 Ознакомлен', disabled: '—',
                          }
                          const roleMap: Record<string, string> = {
                            legal_gc: 'Юрист ГК', legal: 'Юрист',
                            finance_gc: 'Финансист ГК', finance: 'Финансист',
                            accounting: 'Бухгалтерия', director: 'Ген. директор',
                            gc_manager: 'Менеджер ГК', other: 'Доп. участник',
                          }
                          const rows = participants.map((p: Participant, idx: number) => `
                            <tr>
                              <td>${idx + 1}</td>
                              <td>${roleMap[p.role] ?? roleMap[p.stage] ?? p.role ?? ''}</td>
                              <td>${p.user_name ?? ''}</td>
                              <td>${statusMap[p.status] ?? p.status ?? ''}</td>
                              <td>${p.decided_at ? new Date(p.decided_at).toLocaleString('ru-RU') : '—'}</td>
                              <td>${p.comment ?? ''}</td>
                            </tr>`).join('')
                          const edoBlock = session.edo_requested ? `
                            <h3>ПОДПИСАНИЕ ЧЕРЕЗ ЭДО</h3>
                            <table class="info">
                              <tr><td class="label">Статус:</td><td>${session.edo_director_decision === 'approved' ? '✅ Разрешено' : session.edo_director_decision === 'rejected' ? '❌ Отклонено' : '⏳ На рассмотрении'}</td></tr>
                              <tr><td class="label">Кем выдано:</td><td>${(session as {edo_director_name?: string}).edo_director_name ?? '—'}</td></tr>
                              <tr><td class="label">Когда:</td><td>${(session as {edo_director_decided_at?: string}).edo_director_decided_at ? new Date((session as {edo_director_decided_at?: string}).edo_director_decided_at!).toLocaleString('ru-RU') : '—'}</td></tr>
                            </table>` : ''
                          const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Лист согласования — ${contract.number}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; color: #000; }
  .content { margin: 20mm 15mm; }
  h1 { text-align: center; font-size: 16px; margin-bottom: 16px; letter-spacing: 2px; }
  h3 { font-size: 12px; margin: 16px 0 6px; border-bottom: 1px solid #000; padding-bottom: 4px; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.info td { padding: 3px 6px; vertical-align: top; }
  table.info td.label { font-weight: bold; width: 160px; }
  table.participants th { background: #222; color: #fff; padding: 5px 6px; text-align: left; font-size: 11px; }
  table.participants td { padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 11px; vertical-align: top; }
  table.participants tr:nth-child(even) { background: #f9f9f9; }
  .footer { margin-top: 16px; font-size: 10px; color: #555; border-top: 1px solid #ccc; padding-top: 8px; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 10px 20px; display: flex; gap: 10px; align-items: center; z-index: 999; }
  .toolbar span { color: #94a3b8; font-size: 13px; flex: 1; }
  .toolbar button { padding: 7px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-print:hover { background: #2563eb; }
  .btn-save { background: #10b981; color: #fff; }
  .btn-save:hover { background: #059669; }
  @media print { .toolbar { display: none; } .content { margin: 10mm; } }
</style></head><body>
<div class="toolbar">
  <span>📄 Лист согласования</span>
  <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить PDF</button>
</div>
<div class="content">
<h1>ЛИСТ СОГЛАСОВАНИЯ</h1>
<h3>РЕКВИЗИТЫ ДОКУМЕНТА</h3>
<table class="info">
  <tr><td class="label">Компания:</td><td>${contract.company_prefix ?? ''}</td></tr>
  <tr><td class="label">Номер документа:</td><td>${contract.number ?? ''}</td></tr>
  <tr><td class="label">Наименование:</td><td>${contract.title ?? ''}</td></tr>
  <tr><td class="label">Номер контрагента:</td><td>${(contract as {counterparty_contract_number?: string}).counterparty_contract_number ?? '—'}</td></tr>
  <tr><td class="label">Контрагент:</td><td>${contract.counterparty ?? ''}</td></tr>
  <tr><td class="label">Инициатор:</td><td>${session.initiated_by_name ?? ''}</td></tr>
  <tr><td class="label">Дата запуска:</td><td>${new Date(session.created_at).toLocaleDateString('ru-RU')}</td></tr>
  <tr><td class="label">Дедлайн:</td><td>${new Date(session.deadline).toLocaleDateString('ru-RU')}</td></tr>
</table>
<h3>УЧАСТНИКИ СОГЛАСОВАНИЯ</h3>
<table class="participants">
  <thead><tr><th>№</th><th>Роль</th><th>ФИО</th><th>Решение</th><th>Дата и время</th><th>Комментарий</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
${edoBlock}
<div class="footer">
  Документ согласован в системе ЮрИнтел-Эпотос (https://epotos-ur-intel.vercel.app)<br>
  Дата формирования: ${new Date().toLocaleString('ru-RU')}<br>
  ID сессии: ${session.id}
</div>
</div></body></html>`
                          const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          window.open(url, '_blank')
                        }}
                        className="w-full text-sm font-semibold border-2 border-blue-600 text-blue-700 py-2.5 rounded-lg hover:bg-blue-50 transition-colors tracking-wide">
                        📄 ЛИСТ СОГЛАСОВАНИЯ
                      </button>
                          {/* Прервать */}
                      <CancelApprovalButton
                        sessionId={session.id}
                        contractId={contract.id}
                        contractNumber={contract.number}
                        initiatedByBitrixId={session.initiated_by_bitrix_id}
                        onCancelled={() => { loadSession() }}
                      />

                      {/* Способ подписания */}
                      {!['подписан','на_исполнении'].includes(contractStatus) && (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 mt-2">
                          <h3 className="text-xs font-semibold text-gray-700 mb-3">🖊 Способ подписания</h3>
                          {edoError && <p className="text-xs text-red-600 mb-2">{edoError}</p>}
                          {edoSuccess && <p className="text-xs text-green-600 mb-2">{edoSuccess}</p>}

                          {/* Шаг 1: Запрос */}
                          {!session.edo_requested && !session.signing_method && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">Для подписания через ЭДО получите разрешение генерального директора.</p>
                              {(ADMIN_IDS.includes(userId) || contract.author_bitrix_id === userId || ['legal_gc','legal','finance_gc','finance_company'].some(r => currentUserRole === r)) && (
                                <div className="space-y-2">
                                  <select value={selectedEdoDirectorId ?? ''} onChange={e => setSelectedEdoDirectorId(parseInt(e.target.value))}
                                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                                    <option value="">— Выберите ГД —</option>
                                    {edoDirectors.map(d => <option key={d.bitrix_user_id} value={d.bitrix_user_id}>{d.user_name}</option>)}
                                  </select>
                                  <button onClick={handleEdoRequest} disabled={edoLoading || !selectedEdoDirectorId}
                                    className="w-full bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {edoLoading ? '...' : 'Запросить разрешение на ЭДО'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Шаг 2: Ожидание решения ГД */}
                          {session.edo_requested && !session.edo_director_decision && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">Запрос отправлен: <span className="font-medium">{session.edo_director_name}</span></p>
                              {userId === session.edo_director_bitrix_id ? (
                                <div className="space-y-1.5">
                                  <button onClick={() => handleEdoDecision('approved')} disabled={edoLoading}
                                    className="w-full bg-green-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                                    ✅ Разрешить ЭДО
                                  </button>
                                  <button onClick={() => handleEdoDecision('rejected')} disabled={edoLoading}
                                    className="w-full bg-red-500 text-white text-xs px-3 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50">
                                    ❌ Отклонить
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">Ожидается решение директора...</p>
                              )}
                            </div>
                          )}

                          {/* Шаг 3: Выбор метода */}
                          {session.edo_director_decision && !session.signing_method && (
                            <div className="space-y-2">
                              {session.edo_director_decision === 'approved' ? (
                                <div className="space-y-2">
                                  <p className="text-xs text-green-700 font-medium">✅ ЭДО разрешено директором</p>
                                  {['finance_gc','finance_company'].some(r => currentUserRole === r) && (
                                    <div className="space-y-1.5">
                                      <button onClick={() => handleEdoSendTask('edo')} disabled={edoLoading}
                                        className="w-full bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                        {edoLoading ? '...' : '📧 Подписание через ЭДО'}
                                      </button>
                                      <button onClick={() => handleEdoSendTask('simple')} disabled={edoLoading}
                                        className="w-full bg-gray-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                                        ✍️ Простая подпись
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-red-600 font-medium">❌ ЭДО отклонено. Используйте простую подпись.</p>
                              )}
                            </div>
                          )}

                          {/* Шаг 4: Итог */}
                          {session.signing_method && (
                            <div>
                              {session.signing_method === 'edo' ? (
                                <div>
                                  <p className="text-xs text-blue-700 font-medium">📧 Подписание через ЭДО</p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-700 font-medium">✍️ Простая подпись</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
                contractStatus={contractStatus}
                sessionParticipantBitrixIds={
                  session?.approval_participants
                    .map(p => p.bitrix_user_id)
                    .filter((id): id is number => id != null) ?? []
                }
                onStatusChange={(newStatus) => setContractStatus(newStatus)}
              />
            </div>
          )}

          {/* Генерация */}
          {activeTab === 'generate' && (
            <div className="p-6">
              <GenerateFromTemplate contract={contract} onUploaded={loadAttachments} />
            </div>
          )}

          {/* Чат */}
          {activeTab === 'execution' && (
            <ExecutionControl
              contractId={contract.id}
              contractStatus={contractStatus}
              contractNumber={contract.number ?? ''}
              contractTitle={contract.title ?? ''}
              companyPrefix={(contract.number ?? '').split('-')[0]}
              authorBitrixId={contract.author_bitrix_id ?? undefined}
              versions={versions.map(v => ({
                id: v.id,
                file_url: v.file_url,
                file_name: v.file_name,
                version_number: v.version_number,
              }))}
              attachments={attachments.map(a => ({
                id: a.id,
                file_url: a.file_url,
                file_name: a.file_name,
                title: a.title ?? '',
                attachment_type: a.attachment_type ?? '',
              }))}
              userName={user?.name}
              userId={user?.id ? parseInt(user.id) : undefined}
              sessionParticipantBitrixIds={
                session?.approval_participants
                  .map(p => p.bitrix_user_id)
                  .filter((id): id is number => id != null) ?? []
              }
              onStatusChange={(newStatus) => setContractStatus(newStatus)}
            />
          )}

          {activeTab === 'storage' && (
            <StorageConfirm
              contractId={contract.id}
              contractStatus={contractStatus}
              storageConfirmedAt={contract.storage_confirmed_at ?? null}
              storageConfirmedByName={contract.storage_confirmed_by_name ?? null}
              userName={user?.name}
              userId={user?.id ? parseInt(user.id) : undefined}
            />
          )}

          {showSignedModal && (
          <SignedDocumentUploadModal
            contractId={contract.id}
            userName={user?.name ?? ''}
            userBitrixId={user?.id ?? ''}
            fileOptions={signedFileOptions}
            onSuccess={async () => {
              setShowSignedModal(false)
              const docsRes = await fetch(`${baseUrl}/api/signed-documents?contract_id=${contract.id}`)
              const docsData = await docsRes.json()
              if (docsData.documents) setSignedDocs(docsData.documents)
              setContractStatus(prev => prev === 'согласован' ? 'загружен_частично' : prev)
            }}
            onClose={() => setShowSignedModal(false)}
          />
        )}

        {activeTab === 'related' && (
            <RelatedDocuments
              contractId={contract.id}
              contractNumber={contract.number ?? ''}
              contractStatus={contractStatus}
              parentContractId={contract.parent_contract_id ?? null}
              parentContractExternal={contract.parent_contract_external ?? null}
              isChild={contract.is_child ?? false}
              currentUserId={parseInt(user?.id ?? '0')}
              currentUserRole={currentUserRole}
              currentUserCompanies={currentUserCompanies}
            />
          )}

          {activeTab === 'history' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">История действий</h2>
                <button onClick={() => window.location.reload()}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                  🔄 Обновить
                </button>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
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

      {/* Модалка отмены голоса */}
      {revokingParticipantId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">↩ Отмена согласования</h3>
            <p className="text-sm text-gray-600 mb-4">
              Решение участника будет сброшено — он снова получит запрос на согласование.
              {contractStatus === 'согласован' && (
                <span className="block mt-1 text-orange-600 font-medium">
                  ⚠️ Документ вернётся в статус «На согласовании».
                </span>
              )}
            </p>
            {revokeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
                {revokeError}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Причина отмены <span className="text-red-500">*</span>
              </label>
              <textarea
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="Например: ошибочно нажал, требуется пересмотр..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleRevokeVote} disabled={revokeLoading}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {revokeLoading ? 'Отмена...' : '↩ Отменить согласование'}
              </button>
              <button onClick={() => { setRevokingParticipantId(null); setRevokeReason(''); setRevokeError('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal изменения номера документа */}
      {showChangeNumberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Изменить номер документа</h3>
            {changeNumberError && <p className="text-sm text-red-600 mb-3">{changeNumberError}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Новый номер</label>
                <input value={newDocNumber} onChange={e => setNewDocNumber(e.target.value)}
                  placeholder="ТХ-ДОГ-2026/07/1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Причина изменения <span className="text-red-500">*</span></label>
                <textarea value={changeNumberComment} onChange={e => setChangeNumberComment(e.target.value)}
                  placeholder="Например: опечатка в номере при создании"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleChangeNumber} disabled={changeNumberSaving}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {changeNumberSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => { setShowChangeNumberModal(false); setChangeNumberError('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
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
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  Роль
                  <Tooltip text="Обязательный — должен согласовать или отклонить, без этого документ не пройдёт согласование. Для информирования — должен ознакомиться (кнопка «Ознакомлен»), не блокирует итог. Наблюдатель — просто видит документ и чаты, от него ничего не требуется." />
                </label>
                <select value={newParticipantRole}
                  onChange={e => setNewParticipantRole(e.target.value as 'required' | 'optional' | 'observer')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="required">Обязательный</option>
                  <option value="optional">Для информирования</option>
                  <option value="observer">Наблюдатель</option>
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

      {/* Modal отклонения */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Отклонение документа</h3>
            <p className="text-sm text-gray-600 mb-4">
              Вы отклоняете документ <strong>{contract.number}</strong>. Укажите причину.
            </p>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              placeholder="Причина отклонения (обязательно)..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={handleReject} disabled={rejecting || !rejectComment.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {rejecting ? 'Отклонение...' : '✕ Отклонить документ'}
              </button>
              <button onClick={() => { setShowRejectModal(false); setRejectComment('') }}
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
