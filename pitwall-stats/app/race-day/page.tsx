import SectionHeader from '@/components/SectionHeader'
import RaceDayClient from './RaceDayClient'

export interface RaceInfo {
  round: string
  raceName: string
  circuitName: string
  locality: string
  country: string
  date: string
  time: string
  dateTimeISO: string
}

export interface DriverOption {
  code: string
  name: string
  team: string
  teamId: string
  points: number
}

export default function RaceDayPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeader
        title="Race Day Companion"
        subtitle="Countdown to race, lock in your predictions, and play live F1 Bingo."
      />
      <RaceDayClient />
    </div>
  )
}
