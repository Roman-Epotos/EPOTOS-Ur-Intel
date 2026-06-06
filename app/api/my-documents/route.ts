import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')

  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id РѕР±СЏР·Р°С‚РµР»РµРЅ' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  try {
    // 1. Р”РѕРєСѓРјРµРЅС‚С‹ РіРґРµ СЏ СЃРѕРіР»Р°СЃСѓСЋС‰РёР№ (РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Р№) СЃРѕ СЃС‚Р°С‚СѓСЃРѕРј pending
    const { data: myApprovals } = await supabase
      .from('approval_participants')
      .select(`
        id,
        role,
        status,
        stage,
        session_id,
        approval_sessions!inner (
          id,
          contract_id,
          deadline,
          initiated_by_name,
          contracts!inner (
            id,
            number,
            title,
            counterparty,
            status,
            amount
          )
        )
      `)
      .eq('bitrix_user_id', userId)
      .eq('status', 'pending')
      .filter('approval_sessions.contracts.deleted_at', 'is', null)

    // 2. РњРѕРё С‡РµСЂРЅРѕРІРёРєРё
    const { data: myDrafts } = await supabase
      .from('contracts')
      .select('*')
      .eq('author_bitrix_id', userId)
      .eq('status', 'С‡РµСЂРЅРѕРІРёРє')
      .in('document_category', ['contract', 'document'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // 3. Р”РѕРєСѓРјРµРЅС‚С‹ РіРґРµ СЏ РёРЅРёС†РёР°С‚РѕСЂ СЃРѕРіР»Р°СЃРѕРІР°РЅРёСЏ
    const { data: myInitiated } = await supabase
      .from('approval_sessions')
      .select(`
        id,
        deadline,
        status,
        created_at,
        contracts!inner (
          id,
          number,
          title,
          counterparty,
          status,
          amount
        )
      `)
      .eq('initiated_by_bitrix_id', userId)
      .eq('status', 'active')
      .filter('contracts.deleted_at', 'is', null)
      .order('created_at', { ascending: false })
// Фильтруем — только основные документы (не вложения)
    const filteredApprovals = (myApprovals ?? []).filter(p => {
      const sessions = p.approval_sessions as unknown as { contracts: { document_category?: string } }
      const category = sessions?.contracts?.document_category
      return category !== 'attachment'
    })
    const requiredApprovals = filteredApprovals.filter(p => p.role === 'required')
    const optionalApprovals = filteredApprovals.filter(p => p.role === 'optional')
    // Документы на подписи в ЭДО где пользователь автор или участник согласования
    const { data: myEdo } = await supabase
      .from('contracts')
      .select('id, number, title, counterparty, status, amount, company_prefix')
      .eq('status', 'на_подписи_в_эдо')
      .is('deleted_at', null)
      .or(`author_bitrix_id.eq.${userId}`)
      .order('updated_at', { ascending: false })

    return NextResponse.json({
      required_approvals: requiredApprovals,
      optional_approvals: optionalApprovals,
      my_drafts: myDrafts ?? [],
      my_initiated: myInitiated ?? [],
      my_edo: myEdo ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
