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

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const { data: logs } = await supabase
    .from('contract_logs')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  const { data: versions } = await supabase
    .from('versions')
    .select('*')
    .eq('contract_id', id)
    .order('version_number', { ascending: false })

  return (
    <ContractTabs
      contract={contract}
      versions={versions ?? []}
      logs={logs ?? []}
    />
  )
}