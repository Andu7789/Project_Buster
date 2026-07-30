export type OwnerTabId = 'team' | 'learners' | 'submissions' | 'ownerSubmissions' | 'calendar' | 'requests'

const tabs: { id: OwnerTabId; label: string }[] = [
  { id: 'team', label: 'Teams, Clients & Sale Types' },
  { id: 'submissions', label: 'Submissions & Invoices' },
  { id: 'ownerSubmissions', label: 'Owner Submissions' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'learners', label: 'Learners & Training' },
  { id: 'requests', label: 'Requests & Bugs' },
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
