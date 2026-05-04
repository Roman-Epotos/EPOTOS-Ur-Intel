import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  const role = request.nextUrl.searchParams.get('role')
  const companiesParam = request.nextUrl.searchParams.get('companies')

  if (!bitrixUserId || !role) {
    return NextResponse.json({ error: 'Параметры обязательны' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  try {
    let query = supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })

    if (role === 'admin') {
      // Администратор видит все договоры
    } else if (role === 'director' || role === 'legal') {
      // ГД и юристы видят договоры своих компаний
      if (companiesParam) {
        const companies = companiesParam.split(',')
        const prefixFilters = companies.map(c => `number.like.${c}-%`).join(',')
        query = query.or(prefixFilters)
      }
    } else {
      // Обычный пользователь — только свои договоры
      // 1. Созданные им
      // 2. В согласовании которых участвовал
      const { data: participantSessions } = await supabase
        .from('approval_participants')
        .select('approval_sessions!inner(contract_id)')
        .eq('bitrix_user_id', userId)

      const contractIds = participantSessions?.map(
        (p: { approval_sessions: { contract_id: string }[] }) =>
          Array.isArray(p.approval_sessions)
            ? p.approval_sessions[0]?.contract_id
            : (p.approval_sessions as unknown as { contract_id: string }).contract_id
      ).filter(Boolean) as string[] ?? []

      // Добавляем ID договоров где он автор
      const { data: authorContracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('author_bitrix_id', userId)

      const authorIds = authorContracts?.map(c => c.id) ?? []
      const allIds = [...new Set([...contractIds, ...authorIds])]

      if (allIds.length === 0) {
        return NextResponse.json({ contracts: [] })
      }

      query = query.in('id', allIds)
    }

    const { data: contractsRaw, error } = await query
    
    // Проверяем наличие файлов для каждого договора
    const contractIds = (contractsRaw ?? []).map((c: { id: string }) => c.id)
    let versionsMap: Record<string, boolean> = {}
    
    if (contractIds.length > 0) {
      const { data: versions } = await supabase
        .from('versions')
        .select('contract_id')
        .in('contract_id', contractIds)
      
      versionsMap = (versions ?? []).reduce((acc: Record<string, boolean>, v: { contract_id: string }) => {
        acc[v.contract_id] = true
        return acc
      }, {})
    }
    
    // Собираем тип последнего файла по договору
    const { data: versions2 } = await supabase
      .from('versions')
      .select('contract_id, file_name')
      .in('contract_id', contractIds.length > 0 ? contractIds : [''])
      .order('version_number', { ascending: false })

    const fileTypeMap: Record<string, string> = {}
    ;(versions2 ?? []).forEach((v: { contract_id: string, file_name: string }) => {
      if (!fileTypeMap[v.contract_id]) {
        fileTypeMap[v.contract_id] = v.file_name.split('.').pop()?.toLowerCase() ?? ''
      }
    })

    const contracts = (contractsRaw ?? []).map((c: { id: string }) => ({
      ...c,
      has_files: versionsMap[c.id] ?? false,
      file_type: fileTypeMap[c.id] ?? null,
    }))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ contracts: contracts ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}