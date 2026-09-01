export type OwnerTabId =
  | 'team'
  | 'learners'
  | 'submissions'
  | 'invoices'
  | 'ownerSubmissions'
  | 'partnerEarnings'
  | 'serviceInvoices'
  | 'calendar'
  | 'timetable'
  | 'requests'
  | 'account'

const tabs: { id: OwnerTabId; label: string }[] = [
  { id: 'submissions', label: 'Submissions & Invoices' },
  { id: 'invoices', label: 'Worker Invoices' },
  { id: 'ownerSubmissions', label: 'PM Sales' },
  { id: 'partnerEarnings', label: 'Alex & Paige Earnings' },
  { id: 'serviceInvoices', label: 'Service Invoices' },
  { id: 'team', label: 'Teams, Clients & Sale Types' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timetable', label: 'Work Timetable' },
  { id: 'learners', label: 'Learners & Training' },
  { id: 'requests', label: 'Requests & Bugs' },
  { id: 'account', label: 'Account' },
]

export function TabNav({ active, onChange }: { active: OwnerTabId; onChange: (id: OwnerTabId) => void }) {
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
