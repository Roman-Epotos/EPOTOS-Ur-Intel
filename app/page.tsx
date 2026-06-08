import Header from '@/app/components/Header'
import MyDocuments from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
import PersonalStats from '@/app/components/PersonalStats'

export default function HomePage() {
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full px-4 pt-6 flex-shrink-0">
        <Header />
        <MyDocuments />
        <PersonalStats />
      </div>
      <div className="max-w-6xl mx-auto w-full px-4 flex-1 overflow-hidden pb-4">
        <ContractsList />
      </div>
    </div>
  )
}