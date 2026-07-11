import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ContractTabs from '@/app/components/ContractTabs'

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: contract }, { data: logs }, { data: versions }] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).single(),
    supabase.from('contract_logs').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
    supabase.from('versions').select('*').eq('contract_id', id).order('version_number', { ascending: false }),
  ])

  if (!contract || contract.deleted_at) notFound()

  return (
    <ContractTabs
      contract={contract}
      versions={versions ?? []}
      logs={logs ?? []}
    />
  )
}