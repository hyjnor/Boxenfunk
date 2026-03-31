import WhatIfClient from './WhatIfClient'

export default function WhatIfPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 bg-[#38BDF8] rounded-full" />
          <h1 className="text-3xl font-black tracking-tight text-[#F1F5F9] uppercase">
            What-If{' '}
            <span style={{ color: '#38BDF8' }}>Rennmaschine</span>
          </h1>
        </div>
        <p className="text-sm text-[#94A3B8] ml-4 pl-3 border-l border-[#1E293B]">
          Replay historical F1 races and change one pit stop decision to see how the result could have changed.
        </p>
      </div>
      <WhatIfClient />
    </div>
  )
}
