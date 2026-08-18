import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'
import {
  addClient,
  addLearner,
  addOwner,
  addOwnerSubmission,
  addSaleType,
  addWorker,
  createClientInvoice,
  createOwnerSubmissionInvoice,
  deleteClientInvoice,
  deleteOwnerSubmission,
  deleteOwnerSubmissionInvoice,
  deleteProfile,
  deleteSubmission,
  listAllSubmissions,
  listAllTrainingProgress,
  listClientInvoices,
  listClients,
  listLearners,
  listOwners,
  listOwnerSubmissionInvoices,
  listOwnerSubmissionsForRange,
  listPaymentMethods,
  listSaleEntriesForRange,
  listSaleEntriesForWeek,
  listSaleEntriesForWorker,
  listSaleTypes,
  listWorkers,
  markClientInvoiceDealtWith,
  markDealtWith,
  markOwnerSubmissionInvoiceDealtWith,
  setClientActive,
  setProfileStatus,
  setSaleTypeActive,
  updateClientColor,
  updateClientNextInvoiceNumber,
  updateClientOwnerPercents,
  updateClientPayoutDetails,
  updateOwnerSubmission,
  updatePaymentMethodDetails,
  updateWorkerShare,
} from '../data/queries'
import { formatCurrency, getCurrentWeekRange, getNextWeekRange, getPreviousWeekRange, toISODate } from '../lib/dates'
import {
  calcOwnerCut,
  clientPayoutTotal,
  ownerCutPercentForSection,
  PPV_OWNER_SUBMISSION_CATEGORIES,
  SEXTING_OWNER_SUBMISSION_CATEGORIES,
} from '../lib/earnings'
import { DEFAULT_CLIENT_COLOR, nextClientColor } from '../lib/clientColor'
import { fetchUsdToGbpRate, type UsdToGbpRate } from '../lib/exchangeRate'
import { generateOwnerInvoicePdf } from '../lib/invoicePdf'
import { paymentMethodFields, paymentMethodLabel } from '../lib/paymentMethods'
import type {
  Client,
  ClientInvoice,
  OwnerSubmission,
  OwnerSubmissionCategory,
  OwnerSubmissionInvoice,
  PaymentMethod,
  PaymentMethodType,
  PendingContractor,
  Profile,
  ProfileStatus,
  SaleEntry,
  SaleSection,
  SaleType,
  Submission,
  TrainingProgress,
} from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { StatCard } from '../components/StatCard'
import { SubmissionInvoiceModal } from '../components/SubmissionInvoiceModal'
import { ClientInvoiceModal } from '../components/ClientInvoiceModal'
import { OwnerSubmissionInvoiceModal } from '../components/OwnerSubmissionInvoiceModal'
import { PastOwnerInvoicesModal } from '../components/PastOwnerInvoicesModal'
import { WeekTrendChart } from '../components/WeekTrendChart'
import { TabNav, type OwnerTabId } from './OwnerDashboard/TabNav'
import { TeamClientsSaleTypesTab } from './OwnerDashboard/TeamClientsSaleTypesTab'
import { LearnersTrainingTab } from './OwnerDashboard/LearnersTrainingTab'
import { SubmissionsInvoicesTab } from './OwnerDashboard/SubmissionsInvoicesTab'
import { OwnerSubmissionsTab } from './OwnerDashboard/OwnerSubmissionsTab'
import { CalendarTab } from './OwnerDashboard/CalendarTab'
import { RequestsTab } from './OwnerDashboard/RequestsTab'
import { AccountTab } from './OwnerDashboard/AccountTab'

export function OwnerDashboard({ profile }: { profile: Profile }) {
  const { signOut, completePasswordReset } = useAuth()

  const [workers, setWorkers] = useState<Profile[]>([])
  const [owners, setOwners] = useState<Profile[]>([])
  const [learners, setLearners] = useState<Profile[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [saleTypes, setSaleTypes] = useState<SaleType[]>([])
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([])
  const [ownerSubmissions, setOwnerSubmissions] = useState<OwnerSubmission[]>([])
  const [ownerSubmissionInvoices, setOwnerSubmissionInvoices] = useState<OwnerSubmissionInvoice[]>([])
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OwnerTabId>('submissions')

  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = useMemo(() => getCurrentWeekRange(), [])

  // The week the owner is currently reviewing/invoicing from - shared between the "Client
  // invoices" section of Submissions & Invoices and the PM Sales tab, since invoicing normally
  // happens on the Monday/Tuesday after a week ends (once PM Sales has already rolled over to
  // the new week), and both tabs need to be looking at the same past week to reconcile it.
  const [ownerSubmissionsWeekStart, setOwnerSubmissionsWeekStart] = useState(currentWeekStart)
  const [ownerSubmissionsWeekEnd, setOwnerSubmissionsWeekEnd] = useState(currentWeekEnd)
  const [ownerSubmissionsWeekSaleEntries, setOwnerSubmissionsWeekSaleEntries] = useState<SaleEntry[]>([])

  function goToPreviousOwnerInvoicingWeek() {
    const range = getPreviousWeekRange(ownerSubmissionsWeekStart)
    setOwnerSubmissionsWeekStart(range.weekStart)
    setOwnerSubmissionsWeekEnd(range.weekEnd)
  }
  function goToNextOwnerInvoicingWeek() {
    const range = getNextWeekRange(ownerSubmissionsWeekStart)
    setOwnerSubmissionsWeekStart(range.weekStart)
    setOwnerSubmissionsWeekEnd(range.weekEnd)
  }
  function goToCurrentOwnerInvoicingWeek() {
    setOwnerSubmissionsWeekStart(currentWeekStart)
    setOwnerSubmissionsWeekEnd(currentWeekEnd)
  }

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedSubmissionEntries, setSelectedSubmissionEntries] = useState<SaleEntry[]>([])
  const [viewedInvoiceId, setViewedInvoiceId] = useState<string | null>(null)
  const [viewedInvoiceEntries, setViewedInvoiceEntries] = useState<SaleEntry[]>([])

  const [newClientName, setNewClientName] = useState('')
  const [newClientColor, setNewClientColor] = useState(DEFAULT_CLIENT_COLOR)
  const [addingClient, setAddingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const [newSaleTypeLabel, setNewSaleTypeLabel] = useState('')
  const [addingSaleType, setAddingSaleType] = useState(false)
  const [saleTypeError, setSaleTypeError] = useState<string | null>(null)

  const [selectedOwnerSubmissionClientId, setSelectedOwnerSubmissionClientId] = useState<string | null>(null)
  const [pastInvoicesClientId, setPastInvoicesClientId] = useState<string | null>(null)

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

  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [addingOwner, setAddingOwner] = useState(false)
  const [addOwnerError, setAddOwnerError] = useState<string | null>(null)
  const [addOwnerMessage, setAddOwnerMessage] = useState<string | null>(null)
  const [ownerRosterError, setOwnerRosterError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listWorkers(),
      listAllSubmissions(),
      listClients(),
      listSaleTypes(),
      listClientInvoices(),
      listLearners(),
      listAllTrainingProgress(),
      listOwnerSubmissionInvoices(),
      listOwners(),
      listPaymentMethods(),
    ])
      .then(
        ([
          workerData,
          submissionData,
          clientData,
          saleTypeData,
          clientInvoiceData,
          learnerData,
          progressData,
          ownerSubmissionInvoiceData,
          ownerData,
          paymentMethodData,
        ]) => {
          if (cancelled) return
          setWorkers(workerData)
          setSubmissions(submissionData)
          setClients(clientData)
          setNewClientColor(nextClientColor(clientData.map((client) => client.color)))
          setSaleTypes(saleTypeData)
          setClientInvoices(clientInvoiceData)
          setLearners(learnerData)
          setTrainingProgress(progressData)
          setOwnerSubmissionInvoices(ownerSubmissionInvoiceData)
          setOwners(ownerData)
          setPaymentMethods(paymentMethodData)
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

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listOwnerSubmissionsForRange(ownerSubmissionsWeekStart, ownerSubmissionsWeekEnd),
      listSaleEntriesForWeek(ownerSubmissionsWeekStart, ownerSubmissionsWeekEnd),
    ])
      .then(([ownerSubmissionData, saleEntryData]) => {
        if (cancelled) return
        setOwnerSubmissions(ownerSubmissionData)
        setOwnerSubmissionsWeekSaleEntries(saleEntryData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load PM Sales entries.')
      })
    return () => {
      cancelled = true
    }
  }, [ownerSubmissionsWeekStart, ownerSubmissionsWeekEnd])

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
  const selectedClientEntries = selectedClientId
    ? ownerSubmissionsWeekSaleEntries.filter((entry) => entry.client_id === selectedClientId)
    : []
  const selectedClientInvoice = selectedClientId
    ? clientInvoices.find((invoice) => invoice.client_id === selectedClientId && invoice.week_start === ownerSubmissionsWeekStart) ?? null
    : null

  const viewedInvoice = clientInvoices.find((invoice) => invoice.id === viewedInvoiceId) ?? null
  const viewedInvoiceClientName = viewedInvoice
    ? clients.find((client) => client.id === viewedInvoice.client_id)?.name ?? 'Unknown client'
    : ''

  const selectedOwnerSubmissionClient = clients.find((client) => client.id === selectedOwnerSubmissionClientId) ?? null
  const selectedOwnerSubmissionEntries = selectedOwnerSubmissionClientId
    ? ownerSubmissions.filter((entry) => entry.client_id === selectedOwnerSubmissionClientId)
    : []
  const selectedOwnerSubmissionsCutBySection = {
    subscriptions: selectedOwnerSubmissionEntries
      .filter((entry) => entry.category === 'subscriptions')
      .reduce((sum, entry) => sum + entry.owner_cut, 0),
    tips: selectedOwnerSubmissionEntries.filter((entry) => entry.category === 'tips').reduce((sum, entry) => sum + entry.owner_cut, 0),
    livestreams: selectedOwnerSubmissionEntries
      .filter((entry) => entry.category === 'livestreams')
      .reduce((sum, entry) => sum + entry.owner_cut, 0),
    paigeSexting: selectedOwnerSubmissionEntries
      .filter((entry) => entry.category === 'paige_sexting')
      .reduce((sum, entry) => sum + entry.owner_cut, 0),
    alexSexting: selectedOwnerSubmissionEntries
      .filter((entry) => entry.category === 'alex_sexting')
      .reduce((sum, entry) => sum + entry.owner_cut, 0),
  }
  const selectedOwnerSubmissionsCut =
    selectedOwnerSubmissionsCutBySection.subscriptions +
    selectedOwnerSubmissionsCutBySection.tips +
    selectedOwnerSubmissionsCutBySection.livestreams
  const selectedOwnerSubmissionClientInvoice = selectedOwnerSubmissionClientId
    ? clientInvoices.find(
        (invoice) => invoice.client_id === selectedOwnerSubmissionClientId && invoice.week_start === ownerSubmissionsWeekStart,
      ) ?? null
    : null
  const selectedSextingSalesAndCustomsCut =
    (selectedOwnerSubmissionClientInvoice?.owner_cut ?? 0) +
    (selectedOwnerSubmissionClientInvoice?.worker_cut ?? 0) +
    selectedOwnerSubmissionsCutBySection.paigeSexting +
    selectedOwnerSubmissionsCutBySection.alexSexting
  const selectedOwnerSubmissionInvoice = selectedOwnerSubmissionClientId
    ? ownerSubmissionInvoices.find(
        (invoice) => invoice.client_id === selectedOwnerSubmissionClientId && invoice.week_start === ownerSubmissionsWeekStart,
      ) ?? null
    : null

  const pastInvoicesClient = clients.find((client) => client.id === pastInvoicesClientId) ?? null
  const pastInvoicesForClient = pastInvoicesClientId
    ? ownerSubmissionInvoices.filter((invoice) => invoice.client_id === pastInvoicesClientId)
    : []

  /**
   * Workers who logged sale entries for this client in the currently viewed PM Sales week but
   * whose figures for that client aren't finalized yet - either they haven't submitted their
   * weekly timesheet at all, or they've submitted but the owner hasn't confirmed it as checked.
   * The owner invoice (which combines the client-invoice owner cut with that week's owner
   * submissions) isn't final until every one of them is submitted and confirmed. This checks
   * whichever week is being viewed/invoiced in PM Sales - typically last week, since the owner
   * usually invoices on the Monday/Tuesday after it, once PM Sales has rolled over to a new week.
   */
  function pendingContractorsForClient(clientId: string): PendingContractor[] {
    const workerIds = new Set(
      ownerSubmissionsWeekSaleEntries.filter((entry) => entry.client_id === clientId).map((entry) => entry.worker_id),
    )
    return Array.from(workerIds).flatMap((workerId): PendingContractor[] => {
      const name = workers.find((w) => w.id === workerId)?.full_name ?? 'Unknown worker'
      const submission = submissions.find((s) => s.worker_id === workerId && s.week_start === ownerSubmissionsWeekStart)
      if (!submission) return [{ name, status: 'not_submitted' }]
      if (!submission.dealt_with) return [{ name, status: 'awaiting_confirmation' }]
      return []
    })
  }

  const selectedOwnerSubmissionPendingContractors = selectedOwnerSubmissionClientId
    ? pendingContractorsForClient(selectedOwnerSubmissionClientId)
    : []

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

  useEffect(() => {
    if (!viewedInvoice) return
    let cancelled = false
    listSaleEntriesForRange(viewedInvoice.week_start, viewedInvoice.week_end)
      .then((data) => {
        if (!cancelled) setViewedInvoiceEntries(data.filter((entry) => entry.client_id === viewedInvoice.client_id))
      })
      .catch(() => {
        if (!cancelled) setViewedInvoiceEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [viewedInvoice])

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
      const created = await addClient(name, newClientColor)
      setClients((previous) => [...previous, created])
      setNewClientColor(nextClientColor([...clients, created].map((client) => client.color)))
      setNewClientName('')
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not add this client.')
    } finally {
      setAddingClient(false)
    }
  }

  async function handleUpdateClientColor(clientToUpdate: Client, color: string) {
    try {
      const updated = await updateClientColor(clientToUpdate.id, color)
      setClients((previous) => previous.map((c) => (c.id === clientToUpdate.id ? updated : c)))
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not update this client.')
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

  async function handleUpdateClientPayoutDetails(
    clientToUpdate: Client,
    input: { realName: string; paymentMethod: PaymentMethodType | null },
  ) {
    try {
      const updated = await updateClientPayoutDetails(clientToUpdate.id, input)
      setClients((previous) => previous.map((c) => (c.id === clientToUpdate.id ? updated : c)))
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not update this client.')
    }
  }

  async function handleSavePaymentMethod(method: PaymentMethodType, details: Record<string, string>) {
    const updated = await updatePaymentMethodDetails(method, details)
    setPaymentMethods((previous) => previous.map((entry) => (entry.method === method ? updated : entry)))
  }

  async function handleUpdateClientNextInvoiceNumber(clientToUpdate: Client, value: number) {
    try {
      const updated = await updateClientNextInvoiceNumber(clientToUpdate.id, value)
      setClients((previous) => previous.map((c) => (c.id === clientToUpdate.id ? updated : c)))
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not update this client.')
    }
  }

  async function handleUpdateClientOwnerPercents(
    clientToUpdate: Client,
    input: { pmSalesOwnerPercent: number; sextingOwnerPercent: number; customsOwnerPercent: number },
  ) {
    try {
      const updated = await updateClientOwnerPercents(clientToUpdate.id, input)
      setClients((previous) => previous.map((c) => (c.id === clientToUpdate.id ? updated : c)))
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

  async function handleAddOwner(event: FormEvent) {
    event.preventDefault()
    setAddOwnerError(null)
    setAddOwnerMessage(null)

    const name = newOwnerName.trim()
    const email = newOwnerEmail.trim().toLowerCase()

    if (!name || !email) {
      setAddOwnerError('Enter a name and email.')
      return
    }

    setAddingOwner(true)
    try {
      const created = await addOwner({ fullName: name, email })
      setOwners((previous) => {
        const index = previous.findIndex((owner) => owner.id === created.id)
        if (index === -1) return [...previous, created]
        const next = [...previous]
        next[index] = created
        return next
      })
      setNewOwnerName('')
      setNewOwnerEmail('')
      setAddOwnerMessage(
        created.status === 'active'
          ? `${created.full_name} restored - they can sign back in with their existing login.`
          : `${created.full_name} added. They can sign up at the owner portal using ${created.email}.`,
      )
    } catch (err) {
      setAddOwnerError(err instanceof Error ? err.message : 'Could not add owner.')
    } finally {
      setAddingOwner(false)
    }
  }

  async function handleOwnerStatusChange(ownerId: string, status: ProfileStatus) {
    setOwnerRosterError(null)
    try {
      await setProfileStatus(ownerId, status)
      setOwners((previous) => previous.map((owner) => (owner.id === ownerId ? { ...owner, status } : owner)))
    } catch (err) {
      setOwnerRosterError(err instanceof Error ? err.message : 'Could not update this owner.')
    }
  }

  function handleRemoveOwner(owner: Profile) {
    const confirmed = window.confirm(`Remove ${owner.full_name}? They'll be signed out and can't log in again.`)
    if (confirmed) handleOwnerStatusChange(owner.id, 'removed')
  }

  async function handleDeleteOwner(owner: Profile) {
    const confirmed = window.confirm(
      `Permanently delete ${owner.full_name}? Their email becomes free to add again. This can't be undone.`,
    )
    if (!confirmed) return
    setOwnerRosterError(null)
    try {
      await deleteProfile(owner.id)
      setOwners((previous) => previous.filter((entry) => entry.id !== owner.id))
    } catch (err) {
      setOwnerRosterError(err instanceof Error ? err.message : 'Could not delete this owner.')
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await completePasswordReset(newPassword)
      if (error) {
        setPasswordError(error)
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated.')
    } finally {
      setChangingPassword(false)
    }
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

  async function handleConfirmSubmission(submissionId: string) {
    await markDealtWith(submissionId)
    setSubmissions((previous) =>
      previous.map((submission) => (submission.id === submissionId ? { ...submission, dealt_with: true } : submission)),
    )
  }

  async function handleDeleteSubmission(submissionId: string) {
    const submission = submissions.find((entry) => entry.id === submissionId)
    await deleteSubmission(submissionId)
    setSubmissions((previous) => previous.filter((entry) => entry.id !== submissionId))
    if (submission) {
      setOwnerSubmissionsWeekSaleEntries((previous) =>
        previous.filter(
          (entry) =>
            !(
              entry.worker_id === submission.worker_id &&
              entry.entry_date >= submission.week_start &&
              entry.entry_date <= submission.week_end
            ),
        ),
      )
    }
  }

  async function handleCreateClientInvoice(client: Client): Promise<ClientInvoice> {
    const entries = ownerSubmissionsWeekSaleEntries.filter((entry) => entry.client_id === client.id)
    const netBySection: Record<SaleSection, number> = { sexting: 0, customs: 0 }
    for (const entry of entries) netBySection[entry.section] += entry.net

    const created = await createClientInvoice({
      clientId: client.id,
      weekStart: ownerSubmissionsWeekStart,
      weekEnd: ownerSubmissionsWeekEnd,
      sextingNet: netBySection.sexting,
      customsNet: netBySection.customs,
      workerCut: entries.reduce((sum, entry) => sum + entry.earnings, 0),
      ownerCut: (Object.keys(netBySection) as SaleSection[]).reduce(
        (sum, section) => sum + calcOwnerCut(netBySection[section], ownerCutPercentForSection(client, section)),
        0,
      ),
      clientPayout: clientPayoutTotal(entries, client),
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

  async function handleConfirmClientInvoice(client: Client): Promise<ClientInvoice> {
    const existing = clientInvoices.find(
      (invoice) => invoice.client_id === client.id && invoice.week_start === ownerSubmissionsWeekStart,
    )
    const invoice = existing ?? (await handleCreateClientInvoice(client))
    if (invoice.dealt_with) return invoice
    await handleSendClientInvoice(invoice.id)
    return { ...invoice, dealt_with: true }
  }

  async function handleDeleteClientInvoice(invoiceId: string) {
    await deleteClientInvoice(invoiceId)
    setClientInvoices((previous) => previous.filter((invoice) => invoice.id !== invoiceId))
  }

  async function handleAddOwnerSubmission(input: {
    category: OwnerSubmissionCategory
    clientId: string
    entryDate: string
    buyerUsername: string
    gross: number
    defaultOwnerCutPercent: number
    ownerCutPercent?: number
  }) {
    const created = await addOwnerSubmission(input)
    setOwnerSubmissions((previous) => [...previous, created])
  }

  async function handleDeleteOwnerSubmission(entryId: string) {
    await deleteOwnerSubmission(entryId)
    setOwnerSubmissions((previous) => previous.filter((entry) => entry.id !== entryId))
  }

  async function handleUpdateOwnerSubmission(
    entryId: string,
    input: { entryDate: string; buyerUsername: string; gross: number; ownerCutPercent: number },
  ) {
    const updated = await updateOwnerSubmission(entryId, input)
    setOwnerSubmissions((previous) => previous.map((entry) => (entry.id === entryId ? updated : entry)))
  }

  async function handleCreateOwnerSubmissionInvoice(client: Client): Promise<OwnerSubmissionInvoice> {
    const entries = ownerSubmissions.filter((entry) => entry.client_id === client.id)
    const cutFor = (category: OwnerSubmissionCategory) =>
      entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.owner_cut, 0)

    const subscriptionsOwnerCut = cutFor('subscriptions')
    const tipsOwnerCut = cutFor('tips')
    const livestreamsOwnerCut = cutFor('livestreams')
    const paigeSextingOwnerCut = cutFor('paige_sexting')
    const alexSextingOwnerCut = cutFor('alex_sexting')
    // Purchases/Tips/Customs make up "PPV Purchases & Tips"; Paige/Alex sexting fold into
    // "Sexting Sales & Customs" alongside the contractor entries below, not here.
    const ownerSubmissionsCut = subscriptionsOwnerCut + tipsOwnerCut + livestreamsOwnerCut
    const contractorInvoice = clientInvoices.find(
      (invoice) => invoice.client_id === client.id && invoice.week_start === ownerSubmissionsWeekStart,
    )
    // The client is invoiced for the full amount deducted from her earnings that week - both the
    // worker cut (which gets paid out to contractors) and the owner cut - not just the owner's cut.
    const contractorInvoiceOwnerCut = (contractorInvoice?.owner_cut ?? 0) + (contractorInvoice?.worker_cut ?? 0)
    const clientInvoiceOwnerCut = contractorInvoiceOwnerCut + paigeSextingOwnerCut + alexSextingOwnerCut

    const created = await createOwnerSubmissionInvoice({
      clientId: client.id,
      weekStart: ownerSubmissionsWeekStart,
      weekEnd: ownerSubmissionsWeekEnd,
      subscriptionsOwnerCut,
      tipsOwnerCut,
      livestreamsOwnerCut,
      paigeSextingOwnerCut,
      alexSextingOwnerCut,
      ownerSubmissionsCut,
      clientInvoiceOwnerCut,
      combinedOwnerCut: ownerSubmissionsCut + clientInvoiceOwnerCut,
    })
    setOwnerSubmissionInvoices((previous) => [created, ...previous])
    return created
  }

  async function handleSendOwnerSubmissionInvoice(invoiceId: string) {
    await markOwnerSubmissionInvoiceDealtWith(invoiceId)
    setOwnerSubmissionInvoices((previous) =>
      previous.map((invoice) => (invoice.id === invoiceId ? { ...invoice, dealt_with: true } : invoice)),
    )
  }

  async function handleDeleteOwnerSubmissionInvoice(invoiceId: string) {
    await deleteOwnerSubmissionInvoice(invoiceId)
    setOwnerSubmissionInvoices((previous) => previous.filter((invoice) => invoice.id !== invoiceId))
  }

  async function handleDownloadOwnerInvoicePdf(client: Client) {
    const contractorInvoiceForPdf = clientInvoices.find(
      (invoice) => invoice.client_id === client.id && invoice.week_start === ownerSubmissionsWeekStart,
    )
    const contractorInvoiceOwnerCut = (contractorInvoiceForPdf?.owner_cut ?? 0) + (contractorInvoiceForPdf?.worker_cut ?? 0)
    const clientOwnerSubmissions = ownerSubmissions.filter((entry) => entry.client_id === client.id)
    // Paid/Alex sexting fold into "Sexting Sales & Customs" (with the contractor cut above and
    // page-two PDF entries) rather than "PPV Purchases & Tips" - see PPV_OWNER_SUBMISSION_CATEGORIES.
    const ppvOwnerSubmissions = clientOwnerSubmissions.filter((entry) => PPV_OWNER_SUBMISSION_CATEGORIES.includes(entry.category))
    const sextingOwnerSubmissions = clientOwnerSubmissions.filter((entry) =>
      SEXTING_OWNER_SUBMISSION_CATEGORIES.includes(entry.category),
    )
    const ownerSubmissionsCut = ppvOwnerSubmissions.reduce((sum, entry) => sum + entry.owner_cut, 0)
    const sextingSubmissionsCut = sextingOwnerSubmissions.reduce((sum, entry) => sum + entry.owner_cut, 0)
    const clientInvoiceOwnerCut = contractorInvoiceOwnerCut + sextingSubmissionsCut

    let exchangeRate: UsdToGbpRate
    try {
      exchangeRate = await fetchUsdToGbpRate()
    } catch {
      window.alert('Could not fetch today\'s USD to GBP exchange rate - check your connection and try again.')
      return
    }

    const dueDate = new Date(ownerSubmissionsWeekStart)
    dueDate.setDate(dueDate.getDate() + 2) // weeks start Monday - invoices are due the Wednesday of the same week

    const method = client.payment_method
    const methodDetails = method ? paymentMethods.find((entry) => entry.method === method)?.details : undefined
    const paymentMethodLines = method
      ? paymentMethodFields[method]
          .map((field) => ({ label: field.label, value: methodDetails?.[field.key]?.trim() ?? '' }))
          .filter((field) => field.value !== '')
          .map((field) => `${field.label}: ${field.value}`)
      : []

    await generateOwnerInvoicePdf({
      clientName: client.real_name?.trim() || client.name,
      weekStart: ownerSubmissionsWeekStart,
      weekEnd: ownerSubmissionsWeekEnd,
      ownerSubmissionsCut,
      clientInvoiceOwnerCut,
      combinedOwnerCut: ownerSubmissionsCut + clientInvoiceOwnerCut,
      saleEntries: ownerSubmissionsWeekSaleEntries.filter((entry) => entry.client_id === client.id),
      saleTypes,
      sextingOwnerPercent: client.sexting_owner_percent,
      customsOwnerPercent: client.customs_owner_percent,
      ownerSubmissions: ppvOwnerSubmissions,
      sextingOwnerSubmissions,
      exchangeRate: exchangeRate.rate,
      exchangeRateDate: exchangeRate.date,
      invoiceNumber: client.next_invoice_number,
      dateIssuedIso: toISODate(new Date()),
      dateDueIso: toISODate(dueDate),
      billToName: client.real_name?.trim() || client.name,
      paymentMethodLabel: method ? paymentMethodLabel[method] : null,
      paymentMethodLines,
    })

    handleUpdateClientNextInvoiceNumber(client, client.next_invoice_number + 1)
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
              newClientColor={newClientColor}
              addingClient={addingClient}
              clientError={clientError}
              onNewClientNameChange={setNewClientName}
              onNewClientColorChange={setNewClientColor}
              onAddClient={handleAddClient}
              onToggleClient={handleToggleClient}
              onUpdateClientPayoutDetails={handleUpdateClientPayoutDetails}
              onUpdateClientNextInvoiceNumber={handleUpdateClientNextInvoiceNumber}
              onUpdateClientOwnerPercents={handleUpdateClientOwnerPercents}
              onUpdateClientColor={handleUpdateClientColor}
              saleTypes={saleTypes}
              newSaleTypeLabel={newSaleTypeLabel}
              addingSaleType={addingSaleType}
              saleTypeError={saleTypeError}
              onNewSaleTypeLabelChange={setNewSaleTypeLabel}
              onAddSaleType={handleAddSaleType}
              onToggleSaleType={handleToggleSaleType}
            />
          )}

          {activeTab === 'account' && (
            <AccountTab
              currentProfileId={profile.id}
              owners={owners}
              paymentMethods={paymentMethods}
              onSavePaymentMethod={handleSavePaymentMethod}
              newOwnerName={newOwnerName}
              newOwnerEmail={newOwnerEmail}
              addingOwner={addingOwner}
              addOwnerError={addOwnerError}
              addOwnerMessage={addOwnerMessage}
              ownerRosterError={ownerRosterError}
              onNewOwnerNameChange={setNewOwnerName}
              onNewOwnerEmailChange={setNewOwnerEmail}
              onAddOwner={handleAddOwner}
              onOwnerStatusChange={handleOwnerStatusChange}
              onRemoveOwner={handleRemoveOwner}
              onDeleteOwner={handleDeleteOwner}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              changingPassword={changingPassword}
              passwordError={passwordError}
              passwordMessage={passwordMessage}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onChangePassword={handleChangePassword}
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
              weekEntries={ownerSubmissionsWeekSaleEntries}
              clientInvoices={clientInvoices}
              weekStart={ownerSubmissionsWeekStart}
              weekEnd={ownerSubmissionsWeekEnd}
              isCurrentWeek={ownerSubmissionsWeekStart === currentWeekStart}
              onPreviousWeek={goToPreviousOwnerInvoicingWeek}
              onNextWeek={goToNextOwnerInvoicingWeek}
              onJumpToCurrentWeek={goToCurrentOwnerInvoicingWeek}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onViewInvoice={(invoiceId) => setViewedInvoiceId(invoiceId)}
            />
          )}

          {activeTab === 'ownerSubmissions' && (
            <OwnerSubmissionsTab
              activeClients={activeClients}
              ownerSubmissions={ownerSubmissions}
              ownerSubmissionInvoices={ownerSubmissionInvoices}
              clientInvoices={clientInvoices}
              weekStart={ownerSubmissionsWeekStart}
              weekEnd={ownerSubmissionsWeekEnd}
              isCurrentWeek={ownerSubmissionsWeekStart === currentWeekStart}
              onPreviousWeek={goToPreviousOwnerInvoicingWeek}
              onNextWeek={goToNextOwnerInvoicingWeek}
              onJumpToCurrentWeek={goToCurrentOwnerInvoicingWeek}
              onAddOwnerSubmission={handleAddOwnerSubmission}
              onDeleteOwnerSubmission={handleDeleteOwnerSubmission}
              onUpdateOwnerSubmission={handleUpdateOwnerSubmission}
              onOpenInvoice={(client) => setSelectedOwnerSubmissionClientId(client.id)}
              onOpenPastInvoices={(client) => setPastInvoicesClientId(client.id)}
              pendingContractorsForClient={pendingContractorsForClient}
            />
          )}

          {activeTab === 'calendar' && <CalendarTab workers={workers} clients={clients} saleTypes={saleTypes} />}

          {activeTab === 'requests' && <RequestsTab profile={profile} />}
        </>
      )}

      {selectedSubmission && selectedWorker && (
        <SubmissionInvoiceModal
          submission={selectedSubmission}
          workerName={selectedWorker.full_name}
          entries={selectedSubmissionEntries}
          clients={clients}
          onClose={() => setSelectedSubmissionId(null)}
          onConfirm={handleConfirmSubmission}
          onDelete={handleDeleteSubmission}
        />
      )}

      {selectedClient && (
        <ClientInvoiceModal
          client={selectedClient}
          clientName={selectedClient.name}
          weekStart={ownerSubmissionsWeekStart}
          weekEnd={ownerSubmissionsWeekEnd}
          entries={selectedClientEntries}
          workers={workers}
          existingInvoice={selectedClientInvoice}
          onClose={() => setSelectedClientId(null)}
          onConfirm={() => handleConfirmClientInvoice(selectedClient)}
          onDelete={handleDeleteClientInvoice}
        />
      )}

      {viewedInvoice && (
        <ClientInvoiceModal
          client={clients.find((c) => c.id === viewedInvoice.client_id)}
          clientName={viewedInvoiceClientName}
          weekStart={viewedInvoice.week_start}
          weekEnd={viewedInvoice.week_end}
          entries={viewedInvoiceEntries}
          workers={workers}
          existingInvoice={viewedInvoice}
          onClose={() => setViewedInvoiceId(null)}
          onConfirm={() => Promise.resolve(viewedInvoice)}
          onDelete={handleDeleteClientInvoice}
        />
      )}

      {selectedOwnerSubmissionClient && (
        <OwnerSubmissionInvoiceModal
          clientName={selectedOwnerSubmissionClient.name}
          weekStart={ownerSubmissionsWeekStart}
          weekEnd={ownerSubmissionsWeekEnd}
          subscriptionsOwnerCut={selectedOwnerSubmissionsCutBySection.subscriptions}
          tipsOwnerCut={selectedOwnerSubmissionsCutBySection.tips}
          livestreamsOwnerCut={selectedOwnerSubmissionsCutBySection.livestreams}
          paigeSextingOwnerCut={selectedOwnerSubmissionsCutBySection.paigeSexting}
          alexSextingOwnerCut={selectedOwnerSubmissionsCutBySection.alexSexting}
          ownerSubmissionsCut={selectedOwnerSubmissionsCut}
          clientInvoiceOwnerCut={selectedSextingSalesAndCustomsCut}
          hasClientInvoice={selectedOwnerSubmissionClientInvoice !== null}
          existingInvoice={selectedOwnerSubmissionInvoice}
          pendingContractors={selectedOwnerSubmissionPendingContractors}
          onClose={() => setSelectedOwnerSubmissionClientId(null)}
          onCreateInvoice={() => handleCreateOwnerSubmissionInvoice(selectedOwnerSubmissionClient)}
          onSendInvoice={handleSendOwnerSubmissionInvoice}
          onDownloadPdf={() => handleDownloadOwnerInvoicePdf(selectedOwnerSubmissionClient)}
        />
      )}

      {pastInvoicesClient && (
        <PastOwnerInvoicesModal
          clientName={pastInvoicesClient.name}
          invoices={pastInvoicesForClient}
          onClose={() => setPastInvoicesClientId(null)}
          onDelete={handleDeleteOwnerSubmissionInvoice}
        />
      )}
    </div>
  )
}
