import Header from '@/app/components/Header'
import MyDocuments from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
import PersonalStats from '@/app/components/PersonalStats'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 pt-6">
        <Header />
        <MyDocuments />
        <PersonalStats />
      </div>
      <div className="max-w-6xl mx-auto w-full px-4 pb-6">
        <ContractsList />
      </div>
    </div>
  )
}