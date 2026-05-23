import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const DEVELOPER_ID = 30
const ALLOWED_ROLES = ['admin', 'gc_manager', 'finance_gc', 'legal_gc']

// GET — список ролей ГК
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_roles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ roles: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

// POST — назначить роль
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bitrix_user_id, user_name, role, admin_bitrix_id } = body

    if (!bitrix_user_id || !user_name || !role) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 })
    }

    // Только разработчик может назначать admin
    if (role === 'admin' && admin_bitrix_id !== DEVELOPER_ID) {
      return NextResponse.json({ error: 'Только разработчик может назначать администраторов' }, { status: 403 })
    }

    // Проверяем права: разработчик или admin
    const isDeveloper = admin_bitrix_id === DEVELOPER_ID
    if (!isDeveloper) {
      const { data: adminRole } = await supabase
        .from('system_roles')
        .select('role')
        .eq('bitrix_user_id', admin_bitrix_id)
        .single()
      if (!adminRole || adminRole.role !== 'admin') {
        return NextResponse.json({ error: 'Нет прав для назначения ролей' }, { status: 403 })
      }
    }

    // Upsert — обновляем если уже есть
    const { error } = await supabase
      .from('system_roles')
      .upsert({ bitrix_user_id, user_name, role, created_by: admin_bitrix_id },
        { onConflict: 'bitrix_user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

// DELETE — удалить роль
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, admin_bitrix_id } = body

    // Только разработчик может удалять роли
    if (admin_bitrix_id !== DEVELOPER_ID) {
      return NextResponse.json({ error: 'Только разработчик может удалять роли' }, { status: 403 })
    }

    const { error } = await supabase
      .from('system_roles')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}