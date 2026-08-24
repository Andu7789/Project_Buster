export type WorkerTabId = 'earnings' | 'submitCustomerOrder' | 'workTimetable' | 'paymentDetails'

const tabs: { id: WorkerTabId; label: string }[] = [
  { id: 'earnings', label: 'Earnings' },
  { id: 'submitCustomerOrder', label: 'Submit Customer Order' },
  { id: 'workTimetable', label: 'Work Timetable' },
  { id: 'paymentDetails', label: 'Payment Details' },
]

export function TabNav({ active, onChange }: { active: WorkerTabId; onChange: (id: WorkerTabId) => void }) {
  return (
    <div className="tab-nav" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-nav-btn ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
