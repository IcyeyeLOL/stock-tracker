'use client'

import dynamic from 'next/dynamic'

const FinancialCommandCenter = dynamic(
  () => import('@/FinancialCommandCenter_ONE_FILE').then((m) => m.default),
  { ssr: false }
)

export default function WidgetPage() {
  return (
    <div className="min-h-screen">
      <FinancialCommandCenter />
    </div>
  )
}
