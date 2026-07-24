import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'
import {
  addClient,
  addLearner,
  addSaleType,
  addWorker,
  createClientInvoice,
  deleteProfile,
  listAllSubmissions,
  listAllTrainingProgress,
  listClientInvoices,
  listClients,
  listLearners,
  listSaleEntriesForWeek,
  listSaleEntriesForWorker,
  listSaleTypes,
  listWorkers,
  markClientInvoiceDealtWith,
  markDealtWith,
  setClientActive,
  setProfileStatus,
  setSaleTypeActive,
  updateWorkerShare,
} from '../data/queries'
import { formatCurrency, getCurrentWeekRange } from '../lib/dates'
import { calcOwnerCut, clientPayoutTotal } from '../lib/earnings'
import type { Client, ClientInvoice, Profile, ProfileStatus, SaleEntry, SaleSection, SaleType, Submission, TrainingProgress } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { StatCard } from '../components/StatCard'
import { SubmissionInvoiceModal } from '../components/SubmissionInvoiceModal'
import { ClientInvoiceModal } from '../components/ClientInvoiceModal'
import { WeekTrendChart } from '../components/WeekTrendChart'
import { TabNav, type OwnerTabId } from './OwnerDashboard/TabNav'
import { TeamClientsSaleTypesTab } from './OwnerDashboard/TeamClientsSaleTypesTab'
import { LearnersTrainingTab } from './OwnerDashboard/LearnersTrainingTab'
import { SubmissionsInvoicesTab } from './OwnerDashboard/SubmissionsInvoicesTab'
import { CalendarTab } from './OwnerDashboard/CalendarTab'

export function OwnerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()

  const [workers, setWorkers] = useState<Profile[]>([])
  const [learners, setLearners] = useState<Profile[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [saleTypes, setSaleTypes] = useState<SaleType[]>([])
  const [weekEntries, setWeekEntries] = useState<SaleEntry[]>([])
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([])
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OwnerTabId>('team')

  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = useMemo(() => getCurrentWeekRange(), [])

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedSubmissionEntries, setSelectedSubmissionEntries] = useState<SaleEntry[]>([])

  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const [newSaleTypeLabel, setNewSaleTypeLabel] = useState('')
  const [addingSaleType, setAddingSaleType] = useState(false)
  const [saleTypeError, setSaleTypeError] = useState<string | null>(null)

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerEmail, setNewWorkerEmail] = useState('')
  const [newWorkerShare, setNewWorkerShare] = useState('20')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addMessage, setAddMessage] = useState<string | null>(null)

  const [editingShareId, setEditingShareId] = useState<string | null>(null)
  const [shareDraft, setShareDraft] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)

  const [newLearnerName, setNewLearnerName] = useState('')
  const [newLearnerEmail, setNewLearnerEmail] = useState('')
  const [addingLearner, setAddingLearner] = useState(false)
  const [addLearnerError, setAddLearnerError] = useState<string | null>(null)
  const [addLearnerMessage, setAddLearnerMessage] = useState<string | null>(null)
  const [learnerRosterError, setLearnerRosterError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listWorkers(),
      listAllSubmissions(),
      listClients(),
      listSaleTypes(),
      listSaleEntriesForWeek(currentWeekStart, currentWeekEnd),
      listClientInvoices(),
      listLearners(),
      listAllTrainingProgress(),
    ])
      .then(
        ([
          workerData,
          submissionData,
          clientData,
          saleTypeData,
          weekEntryData,
          clientInvoiceData,
          learnerData,
          progressData,
        ]) => {
          if (cancelled) return
          setWorkers(workerData)
          setSubmissions(submissionData)
          setClients(clientData)
          setSaleTypes(saleTypeData)
          setWeekEntries(weekEntryData)
          setClientInvoices(clientInvoiceData)
          setLearners(learnerData)
          setTrainingProgress(progressData)
          setSelectedWorkerId((current) => current ?? workerData[0]?.id ?? null)
        },
      )
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load dashboard data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentWeekStart, currentWeekEnd])

  const activeWorkers = workers.filter((worker) => worker.status === 'active').length
  const pendingInvites = workers.filter((worker) => worker.status === 'pending').length
  const pendingSubmissions = submissions.filter((submission) => !submission.dealt_with).length

  const totalThisMonth = useMemo(() => {
    const now = new Date()
    return submissions
      .filter((submission) => {
        const start = new Date(submission.week_start)
        return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
      })
      .reduce((sum, submission) => sum + submission.amount, 0)
  }, [submissions])

  const trendData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const submission of submissions) {
      totals.set(submission.week_start, (totals.get(submission.week_start) ?? 0) + submission.amount)
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([weekStart, total]) => ({
        label: new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        total,
      }))
  }, [submissions])

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? null
  const selectedWorkerSubmissions = submissions.filter((submission) => submission.worker_id === selectedWorkerId)
  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null

  const activeClients = clients.filter((client) => client.active)
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null
  const selectedClientEntries = selectedClientId ? weekEntries.filter((entry) => entry.client_id === selectedClientId) : []
  const selectedClientInvoice = selectedClientId
    ? clientInvoices.find((invoice) => invoice.client_id === selectedClientId && invoice.week_start === currentWeekStart) ?? null
    : null

  const progressByLearner = useMemo(() => {
    const map = new Map<string, TrainingProgress[]>()
    for (const row of trainingProgress) {
      const rows = map.get(row.learner_id) ?? []
      rows.push(row)
      map.set(row.learner_id, rows)
    }
    return map
  }, [trainingProgress])

  useEffect(() => {
    if (!selectedSubmission) return
    let cancelled = false
    listSaleEntriesForWorker(selectedSubmission.worker_id, selectedSubmission.week_start, selectedSubmission.week_end)
      .then((data) => {
        if (!cancelled) setSelectedSubmissionEntries(data)
      })
      .catch(() => {
        if (!cancelled) setSelectedSubmissionEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedSubmission])

  async function handleAddWorker(event: FormEvent) {
    event.preventDefault()
    setAddError(null)
    setAddMessage(null)

    const name = newWorkerName.trim()
    const email = newWorkerEmail.trim().toLowerCase()
    const share = Number(newWorkerShare)

    if (!name || !email) {
      setAddError('Enter a name and email.')
      return
    }
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      setAddError('Owner share must be a number between 0 and 100.')
      return
    }

    setAdding(true)
    try {
      const created = await addWorker({ fullName: name, email, ownerSharePercent: share })
      setWorkers((previous) => {
        const index = previous.findIndex((worker) => worker.id === created.id)
        if (index === -1) return [...previous, created]
        const next = [...previous]
        next[index] = created
        return next
      })
      setNewWorkerName('')
      setNewWorkerEmail('')
      setNewWorkerShare('20')
      setAddMessage(
        created.status === 'active'
          ? `${created.full_name} restored - they can sign back in with their existing login.`
          : `${created.full_name} added. They can sign up at the worker portal using ${created.email}.`,
      )
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add worker.')
    } finally {
      setAdding(false)
    }
  }

  function startEditShare(worker: Profile) {
    setEditingShareId(worker.id)
    setShareDraft(String(worker.owner_share_percent))
    setShareError(null)
  }

  async function handleSaveShare(workerId: string) {
    const value = Number(shareDraft)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setShareError('Enter a number between 0 and 100.')
      return
    }
    try {
      await updateWorkerShare(workerId, value)
      setWorkers((previous) => previous.map((worker) => (worker.id === workerId ? { ...worker, owner_share_percent: value } : worker)))
      setEditingShareId(null)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not update share.')
    }
  }

  async function handleStatusChange(workerId: string, status: ProfileStatus) {
    setRosterError(null)
    try {
      await setProfileStatus(workerId, status)
      setWorkers((previous) => previous.map((worker) => (worker.id === workerId ? { ...worker, status } : worker)))
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not update this worker.')
    }
  }

  function handleRemove(worker: Profile) {
    const confirmed = window.confirm(
      `Remove ${worker.full_name}? Their timesheet history is kept, but they'll be signed out and can't log in again.`,
    )
    if (confirmed) handleStatusChange(worker.id, 'removed')
  }

  async function handleAddClient(event: FormEvent) {
    event.preventDefault()
    setClientError(null)
    const name = newClientName.trim()
    if (!name) {
      setClientError('Enter a client name.')
      return
    }
    setAddingClient(true)
    try {
      const created = await addClient(name)
      setClients((previous) => [...previous, created])
      setNewClientName('')
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not add this client.')
    } finally {
      setAddingClient(false)
    }
  }

  async function handleToggleClient(clientToToggle: Client) {
    const active = !clientToToggle.active
    try {
      await setClientActive(clientToToggle.id, active)
      setClients((previous) => previous.map((c) => (c.id === clientToToggle.id ? { ...c, active } : c)))
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not update this client.')
    }
  }

  async function handleAddSaleType(event: FormEvent) {
    event.preventDefault()
    setSaleTypeError(null)
    const label = newSaleTypeLabel.trim()
    if (!label) {
      setSaleTypeError('Enter a type name.')
      return
    }
    setAddingSaleType(true)
    try {
      const created = await addSaleType(label)
      setSaleTypes((previous) => [...previous, created])
      setNewSaleTypeLabel('')
    } catch (err) {
      setSaleTypeError(err instanceof Error ? err.message : 'Could not add this type.')
    } finally {
      setAddingSaleType(false)
    }
  }

  async function handleToggleSaleType(saleTypeToToggle: SaleType) {
    const active = !saleTypeToToggle.active
    try {
      await setSaleTypeActive(saleTypeToToggle.id, active)
      setSaleTypes((previous) => previous.map((t) => (t.id === saleTypeToToggle.id ? { ...t, active } : t)))
    } catch (err) {
      setSaleTypeError(err instanceof Error ? err.message : 'Could not update this type.')
    }
  }

  async function handleDeleteWorker(worker: Profile) {
    const confirmed = window.confirm(
      `Permanently delete ${worker.full_name}? This also deletes their submission and timesheet history, and their email becomes free to add again. This can't be undone.`,
    )
    if (!confirmed) return
    setRosterError(null)
    try {
      await deleteProfile(worker.id)
      setWorkers((previous) => previous.filter((entry) => entry.id !== worker.id))
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not delete this worker.')
    }
  }

  async function handleAddLearner(event: FormEvent) {
    event.preventDefault()
    setAddLearnerError(null)
    setAddLearnerMessage(null)

    const name = newLearnerName.trim()
    const email = newLearnerEmail.trim().toLowerCase()

    if (!name || !email) {
      setAddLearnerError('Enter a name and email.')
      return
    }

    setAddingLearner(true)
    try {
      const created = await addLearner({ fullName: name, email })
      setLearners((previous) => {
        const index = previous.findIndex((learner) => learner.id === created.id)
        if (index === -1) return [...previous, created]
        const next = [...previous]
        next[index] = created
        return next
      })
      setNewLearnerName('')
      setNewLearnerEmail('')
      setAddLearnerMessage(
        created.status === 'active'
          ? `${created.full_name} restored - they can sign back in with their existing login.`
          : `${created.full_name} added. They can sign up at the learner portal using ${created.email}.`,
      )
    } catch (err) {
      setAddLearnerError(err instanceof Error ? err.message : 'Could not add learner.')
    } finally {
      setAddingLearner(false)
    }
  }

  async function handleLearnerStatusChange(learnerId: string, status: ProfileStatus) {
    setLearnerRosterError(null)
    try {
      await setProfileStatus(learnerId, status)
      setLearners((previous) => previous.map((learner) => (learner.id === learnerId ? { ...learner, status } : learner)))
    } catch (err) {
      setLearnerRosterError(err instanceof Error ? err.message : 'Could not update this learner.')
    }
  }

  function handleRemoveLearner(learner: Profile) {
    const confirmed = window.confirm(`Remove ${learner.full_name}? They'll be signed out and can't log in again.`)
    if (confirmed) handleLearnerStatusChange(learner.id, 'removed')
  }

  async function handleDeleteLearner(learner: Profile) {
    const confirmed = window.confirm(
      `Permanently delete ${learner.full_name}? This also deletes their training progress, and their email becomes free to add again. This can't be undone.`,
    )
    if (!confirmed) return
    setLearnerRosterError(null)
    try {
      await deleteProfile(learner.id)
      setLearners((previous) => previous.filter((entry) => entry.id !== learner.id))
    } catch (err) {
      setLearnerRosterError(err instanceof Error ? err.message : 'Could not delete this learner.')
    }
  }

  async function handleSendInvoice(submissionId: string) {
    await markDealtWith(submissionId)
    setSubmissions((previous) =>
      previous.map((submission) => (submission.id === submissionId ? { ...submission, dealt_with: true } : submission)),
    )
  }

  async function handleCreateClientInvoice(client: Client): Promise<ClientInvoice> {
    const entries = weekEntries.filter((entry) => entry.client_id === client.id)
    const netBySection: Record<SaleSection, number> = { sexting: 0, customs: 0 }
    for (const entry of entries) netBySection[entry.section] += entry.net

    const created = await createClientInvoice({
      clientId: client.id,
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      sextingNet: netBySection.sexting,
      customsNet: netBySection.customs,
      workerCut: entries.reduce((sum, entry) => sum + entry.earnings, 0),
      ownerCut: (Object.keys(netBySection) as SaleSection[]).reduce(
        (sum, section) => sum + calcOwnerCut(netBySection[section], section),
        0,
      ),
      clientPayout: clientPayoutTotal(entries),
    })
    setClientInvoices((previous) => [created, ...previous])
    return created
  }

  async function handleSendClientInvoice(invoiceId: string) {
    await markClientInvoiceDealtWith(invoiceId)
    setClientInvoices((previous) =>
      previous.map((invoice) => (invoice.id === invoiceId ? { ...invoice, dealt_with: true } : invoice)),
    )
  }

  return (
    <div className="app-shell">
      <PortalHeader portalLabel="Owner portal" userName={profile.full_name} onSignOut={signOut} />

      {loading ? (
        <p className="info-text">Loading dashboard…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <section className="stat-grid">
            <StatCard label="Active workers" value={String(activeWorkers)} hint={`${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}`} />
            <StatCard
              label="Pending submissions"
              value={String(pendingSubmissions)}
              hint="awaiting invoice"
              tone={pendingSubmissions > 0 ? 'danger' : 'default'}
            />
            <StatCard label="Paid out this month" value={formatCurrency(totalThisMonth)} />
            <StatCard label="Team size" value={String(workers.length)} hint="all-time" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Weekly totals</h2>
                <p>Submitted amounts across your whole team, most recent weeks.</p>
              </div>
            </div>
            {trendData.length === 0 ? (
              <p className="info-text">No submissions yet.</p>
            ) : (
              <WeekTrendChart data={trendData} />
            )}
          </section>

          <TabNav active={activeTab} onChange={setActiveTab} />

          {activeTab === 'team' && (
            <TeamClientsSaleTypesTab
              workers={workers}
              editingShareId={editingShareId}
              shareDraft={shareDraft}
              shareError={shareError}
              rosterError={rosterError}
              newWorkerName={newWorkerName}
              newWorkerEmail={newWorkerEmail}
              newWorkerShare={newWorkerShare}
              adding={adding}
              addError={addError}
              addMessage={addMessage}
              onNewWorkerNameChange={setNewWorkerName}
              onNewWorkerEmailChange={setNewWorkerEmail}
              onNewWorkerShareChange={setNewWorkerShare}
              onAddWorker={handleAddWorker}
              onStartEditShare={startEditShare}
              onShareDraftChange={setShareDraft}
              onSaveShare={handleSaveShare}
              onCancelEditShare={() => setEditingShareId(null)}
              onStatusChange={handleStatusChange}
              onRemove={handleRemove}
              onDeleteWorker={handleDeleteWorker}
              clients={clients}
              newClientName={newClientName}
              addingClient={addingClient}
              clientError={clientError}
              onNewClientNameChange={setNewClientName}
              onAddClient={handleAddClient}
              onToggleClient={handleToggleClient}
              saleTypes={saleTypes}
              newSaleTypeLabel={newSaleTypeLabel}
              addingSaleType={addingSaleType}
              saleTypeError={saleTypeError}
              onNewSaleTypeLabelChange={setNewSaleTypeLabel}
              onAddSaleType={handleAddSaleType}
              onToggleSaleType={handleToggleSaleType}
            />
          )}

          {activeTab === 'learners' && (
            <LearnersTrainingTab
              learners={learners}
              newLearnerName={newLearnerName}
              newLearnerEmail={newLearnerEmail}
              addingLearner={addingLearner}
              addLearnerError={addLearnerError}
              addLearnerMessage={addLearnerMessage}
              learnerRosterError={learnerRosterError}
              onNewLearnerNameChange={setNewLearnerName}
              onNewLearnerEmailChange={setNewLearnerEmail}
              onAddLearner={handleAddLearner}
              onLearnerStatusChange={handleLearnerStatusChange}
              onRemoveLearner={handleRemoveLearner}
              onDeleteLearner={handleDeleteLearner}
              progressByLearner={progressByLearner}
            />
          )}

          {activeTab === 'submissions' && (
            <SubmissionsInvoicesTab
              workers={workers}
              submissions={submissions}
              selectedWorkerId={selectedWorkerId}
              selectedWorker={selectedWorker}
              selectedWorkerSubmissions={selectedWorkerSubmissions}
              onSelectWorker={setSelectedWorkerId}
              onSelectSubmission={setSelectedSubmissionId}
              activeClients={activeClients}
              clients={clients}
              weekEntries={weekEntries}
              clientInvoices={clientInvoices}
              currentWeekStart={currentWeekStart}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
            />
          )}

          {activeTab === 'calendar' && <CalendarTab workers={workers} clients={clients} saleTypes={saleTypes} />}
        </>
      )}

      {selectedSubmission && selectedWorker && (
        <SubmissionInvoiceModal
          submission={selectedSubmission}
          workerName={selectedWorker.full_name}
          workerEmail={selectedWorker.email}
          entries={selectedSubmissionEntries}
          clients={clients}
          onClose={() => setSelectedSubmissionId(null)}
          onSendInvoice={handleSendInvoice}
        />
      )}

      {selectedClient && (
        <ClientInvoiceModal
          clientName={selectedClient.name}
          weekStart={currentWeekStart}
          weekEnd={currentWeekEnd}
          entries={selectedClientEntries}
          workers={workers}
          existingInvoice={selectedClientInvoice}
          onClose={() => setSelectedClientId(null)}
          onCreateInvoice={() => handleCreateClientInvoice(selectedClient)}
          onSendInvoice={handleSendClientInvoice}
        />
      )}
    </div>
  )
}
