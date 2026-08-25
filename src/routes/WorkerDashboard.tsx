import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/authContext'
import {
  createInvoiceForSubmission,
  getWorkerPaymentDetails,
  listClients,
  listCustomerOrdersForWorker,
  listSaleEntriesForWorker,
  listSaleTypes,
  listSubmissionsForWorker,
  notifyTelegram,
  submitTimesheet,
  upsertWorkerPaymentDetails,
} from '../data/queries'
import { generateWorkerInvoicePdf } from '../lib/invoicePdf'
import {
  daysOfWeek,
  formatDayLabel,
  getCurrentWeekRange,
  getPreviousWeekRange,
  getWeekDates,
  isWithinGracePeriod,
  toISODate,
} from '../lib/dates'
import { breakdownByClientAndSection, earningsByClient, invoiceNumberFor, type ClientEarningsTotal } from '../lib/earnings'
import { missingCustomerOrderFields } from '../lib/customerOrders'
import { paymentMethodFields, paymentMethodLabel } from '../lib/paymentMethods'
import type { Client, CustomerOrder, PaymentMethodType, Profile, SaleEntry, SaleType, Submission, WorkerPaymentDetails } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { MissingCustomerOrdersModal, type MissingCustomerOrderRow } from '../components/MissingCustomerOrdersModal'
import { TabNav, type WorkerTabId } from './WorkerDashboard/TabNav'
import { EarningsTab } from './WorkerDashboard/EarningsTab'
import { SubmitCustomerOrderTab } from './WorkerDashboard/SubmitCustomerOrderTab'
import { WorkTimetableTab } from './WorkerDashboard/WorkTimetableTab'
import { PaymentDetailsTab } from './WorkerDashboard/PaymentDetailsTab'

export function WorkerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<WorkerTabId>('earnings')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [saleTypes, setSaleTypes] = useState<SaleType[]>([])
  const [weekEntries, setWeekEntries] = useState<SaleEntry[]>([])
  const [previousWeekEntries, setPreviousWeekEntries] = useState<SaleEntry[]>([])
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [paymentDetails, setPaymentDetails] = useState<WorkerPaymentDetails | null>(null)
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedSubmissionEntries, setSelectedSubmissionEntries] = useState<SaleEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [missingOrderRows, setMissingOrderRows] = useState<MissingCustomerOrderRow[] | null>(null)
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  const { weekStart, weekEnd } = useMemo(() => getCurrentWeekRange(), [])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const previousWeek = useMemo(() => getPreviousWeekRange(weekStart), [weekStart])
  const previousWeekDates = useMemo(() => getWeekDates(previousWeek.weekStart), [previousWeek.weekStart])
  const graceActive = useMemo(() => isWithinGracePeriod(), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSubmissionsForWorker(profile.id),
      listClients(),
      listSaleTypes(),
      listSaleEntriesForWorker(profile.id, weekStart, weekEnd),
      graceActive
        ? listSaleEntriesForWorker(profile.id, previousWeek.weekStart, previousWeek.weekEnd)
        : Promise.resolve([]),
      listCustomerOrdersForWorker(profile.id),
      getWorkerPaymentDetails(profile.id),
    ])
      .then(([submissionData, clientData, saleTypeData, entryData, previousEntryData, customerOrderData, paymentDetailsData]) => {
        if (cancelled) return
        setSubmissions(submissionData)
        setClients(clientData)
        setSaleTypes(saleTypeData)
        setWeekEntries(entryData)
        setPreviousWeekEntries(previousEntryData)
        setCustomerOrders(customerOrderData)
        setPaymentDetails(paymentDetailsData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your timesheets.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmissions(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile.id, weekStart, weekEnd, graceActive, previousWeek.weekStart, previousWeek.weekEnd])

  const currentWeekSubmission = submissions.find((submission) => submission.week_start === weekStart) ?? null
  const previousWeekSubmission = submissions.find((submission) => submission.week_start === previousWeek.weekStart) ?? null
  const alreadySubmittedThisWeek = currentWeekSubmission !== null
  const alreadySubmittedLastWeek = previousWeekSubmission !== null
  // Keeps the "Last week" panel open through the grace period even after submitting, as long as
  // its invoice hasn't been created yet - "Submit earnings" and "Create & send weekly invoice"
  // are separate steps, so there needs to still be somewhere to do the second one from.
  const showLastWeekPanel = graceActive && (!previousWeekSubmission || previousWeekSubmission.invoice_number === null)
  const lifetimeTotal = useMemo(() => submissions.reduce((sum, submission) => sum + submission.amount, 0), [submissions])

  const totalsByDate = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of weekEntries) {
      totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + entry.earnings)
    }
    return totals
  }, [weekEntries])

  const previousTotalsByDate = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of previousWeekEntries) {
      totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + entry.earnings)
    }
    return totals
  }, [previousWeekEntries])

  const liveTotal = useMemo(() => weekEntries.reduce((sum, entry) => sum + entry.earnings, 0), [weekEntries])
  const previousLiveTotal = useMemo(
    () => previousWeekEntries.reduce((sum, entry) => sum + entry.earnings, 0),
    [previousWeekEntries],
  )

  const clientTotals = useMemo(() => earningsByClient(weekEntries, clients), [weekEntries, clients])
  const previousClientTotals = useMemo(
    () => earningsByClient(previousWeekEntries, clients),
    [previousWeekEntries, clients],
  )

  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null

  useEffect(() => {
    if (!selectedSubmission) return
    let cancelled = false
    listSaleEntriesForWorker(profile.id, selectedSubmission.week_start, selectedSubmission.week_end)
      .then((data) => {
        if (!cancelled) setSelectedSubmissionEntries(data)
      })
      .catch(() => {
        if (!cancelled) setSelectedSubmissionEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedSubmission, profile.id])

  const selectedSubmissionClientTotals = useMemo(
    () => earningsByClient(selectedSubmissionEntries, clients),
    [selectedSubmissionEntries, clients],
  )
  const selectedSubmissionBreakdown = useMemo(
    () => breakdownByClientAndSection(selectedSubmissionEntries, clients),
    [selectedSubmissionEntries, clients],
  )

  const selectedIsPreviousWeek = selectedDate !== null && previousWeekDates.includes(selectedDate)
  const selectedWeekDates = selectedIsPreviousWeek ? previousWeekDates : weekDates
  const selectedDayIndex = selectedDate ? selectedWeekDates.indexOf(selectedDate) : -1
  const selectedDayEntries = selectedDate
    ? [...weekEntries, ...previousWeekEntries].filter((entry) => entry.entry_date === selectedDate)
    : []
  const selectedDayReadOnly = selectedIsPreviousWeek ? alreadySubmittedLastWeek : alreadySubmittedThisWeek
  const selectedDayLabel =
    selectedDate && selectedDayIndex !== -1 ? formatDayLabel(daysOfWeek[selectedDayIndex], selectedDate) : ''

  function handleEntryAdded(entry: SaleEntry) {
    if (previousWeekDates.includes(entry.entry_date)) {
      setPreviousWeekEntries((previous) => [...previous, entry])
    } else {
      setWeekEntries((previous) => [...previous, entry])
    }
  }

  function handleEntryDeleted(entryId: string) {
    setWeekEntries((previous) => previous.filter((entry) => entry.id !== entryId))
    setPreviousWeekEntries((previous) => previous.filter((entry) => entry.id !== entryId))
    setCustomerOrders((previous) => previous.filter((order) => order.sale_entry_id !== entryId))
  }

  function handleOrderSaved(order: CustomerOrder) {
    setCustomerOrders((previous) => {
      const existingIndex = previous.findIndex((candidate) => candidate.id === order.id)
      if (existingIndex === -1) return [...previous, order]
      const next = [...previous]
      next[existingIndex] = order
      return next
    })
  }

  async function handleSavePaymentDetails(method: PaymentMethodType, details: Record<string, string>) {
    const saved = await upsertWorkerPaymentDetails({ workerId: profile.id, method, details })
    setPaymentDetails(saved)
  }

  function findMissingCustomerOrders(entries: SaleEntry[]): MissingCustomerOrderRow[] {
    return entries
      .filter((entry) => entry.section === 'customs')
      .map((entry) => ({
        entry,
        missingFields: missingCustomerOrderFields(customerOrders.find((order) => order.sale_entry_id === entry.id)),
      }))
      .filter((row) => row.missingFields.length > 0)
  }

  async function submitWeek(params: {
    weekStart: string
    weekEnd: string
    weekDates: string[]
    totalsByDate: Map<string, number>
    entries: SaleEntry[]
  }) {
    setFormError(null)
    setMessage(null)

    const missingRows = findMissingCustomerOrders(params.entries)
    if (missingRows.length > 0) {
      setMissingOrderRows(missingRows)
      return
    }

    const dayAmounts: Record<string, number> = {}
    daysOfWeek.forEach((day, index) => {
      const total = params.totalsByDate.get(params.weekDates[index]) ?? 0
      if (total > 0) dayAmounts[day] = total
    })

    const total = Object.values(dayAmounts).reduce((sum, value) => sum + value, 0)
    if (!total) {
      setFormError('Add at least one entry before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const created = await submitTimesheet({
        workerId: profile.id,
        weekStart: params.weekStart,
        weekEnd: params.weekEnd,
        dayAmounts,
        amount: total,
        ownerSharePercent: profile.owner_share_percent,
      })
      setSubmissions((previous) => [created, ...previous])
      setMessage('Weekly submission sent to your employer.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your timesheet.')
    } finally {
      setSubmitting(false)
    }
  }

  /** The separate "Create & send weekly invoice" step - only runs after a week's earnings are already submitted. */
  async function handleCreateInvoice(submission: Submission, clientTotals: ClientEarningsTotal[]) {
    setInvoiceError(null)
    setCreatingInvoiceFor(submission.id)
    try {
      const invoiced = await createInvoiceForSubmission(submission.id)
      const nextSubmissions = submissions.map((entry) => (entry.id === invoiced.id ? invoiced : entry))
      setSubmissions(nextSubmissions)
      await downloadInvoicePdf(invoiced, clientTotals, nextSubmissions)
      void notifyTelegram('worker_invoice_created', {
        actorName: profile.full_name,
        weekStart: invoiced.week_start,
        weekEnd: invoiced.week_end,
        amount: invoiced.amount,
      })
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Could not create the invoice.')
    } finally {
      setCreatingInvoiceFor(null)
    }
  }

  async function downloadInvoicePdf(submission: Submission, clientTotals: ClientEarningsTotal[], workerSubmissions: Submission[]) {
    // Weeks start Monday - the invoice is sent the following Monday, due the Wednesday of that same week.
    const dueDate = new Date(submission.week_start)
    dueDate.setDate(dueDate.getDate() + 9)

    const method = paymentDetails?.method ?? null
    const paymentMethodLines = method
      ? paymentMethodFields[method]
          .map((field) => ({ label: field.label, value: paymentDetails?.details[field.key]?.trim() ?? '' }))
          .filter((field) => field.value !== '')
          .map((field) => `${field.label}: ${field.value}`)
      : []

    await generateWorkerInvoicePdf({
      workerName: profile.full_name,
      weekStart: submission.week_start,
      weekEnd: submission.week_end,
      invoiceNumber: submission.invoice_number ?? invoiceNumberFor(submission, workerSubmissions),
      dateIssuedIso: toISODate(new Date()),
      dateDueIso: toISODate(dueDate),
      clientTotals,
      amount: submission.amount,
      paymentMethodLabel: method ? paymentMethodLabel[method] : null,
      paymentMethodLines,
    })
  }

  const handleSubmit = () => submitWeek({ weekStart, weekEnd, weekDates, totalsByDate, entries: weekEntries })
  const handleSubmitLastWeek = () =>
    submitWeek({
      weekStart: previousWeek.weekStart,
      weekEnd: previousWeek.weekEnd,
      weekDates: previousWeekDates,
      totalsByDate: previousTotalsByDate,
      entries: previousWeekEntries,
    })

  const graceDeadlineLabel = useMemo(
    () => new Date(weekDates[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    [weekDates],
  )

  return (
    <div className="app-shell">
      <PortalHeader portalLabel="Worker portal" userName={profile.full_name} onSignOut={signOut} />

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'earnings' && (
        <EarningsTab
          weekStart={weekStart}
          weekEnd={weekEnd}
          weekDates={weekDates}
          totalsByDate={totalsByDate}
          clientTotals={clientTotals}
          liveTotal={liveTotal}
          alreadySubmittedThisWeek={alreadySubmittedThisWeek}
          currentWeekSubmission={currentWeekSubmission}
          onSubmit={handleSubmit}
          onDayClick={setSelectedDate}
          showLastWeekPanel={showLastWeekPanel}
          previousWeek={previousWeek}
          previousWeekDates={previousWeekDates}
          previousTotalsByDate={previousTotalsByDate}
          previousClientTotals={previousClientTotals}
          previousLiveTotal={previousLiveTotal}
          previousWeekSubmission={previousWeekSubmission}
          graceDeadlineLabel={graceDeadlineLabel}
          onSubmitLastWeek={handleSubmitLastWeek}
          submitting={submitting}
          formError={formError}
          message={message}
          onCreateInvoice={handleCreateInvoice}
          creatingInvoiceFor={creatingInvoiceFor}
          invoiceError={invoiceError}
          submissions={submissions}
          loadingSubmissions={loadingSubmissions}
          loadError={loadError}
          lifetimeTotal={lifetimeTotal}
          onSelectSubmission={setSelectedSubmissionId}
          selectedSubmission={selectedSubmission}
          selectedSubmissionClientTotals={selectedSubmissionClientTotals}
          selectedSubmissionBreakdown={selectedSubmissionBreakdown}
          onCloseSubmissionModal={() => setSelectedSubmissionId(null)}
          onDownloadInvoice={(submission, clientTotals) => downloadInvoicePdf(submission, clientTotals, submissions)}
          selectedDate={selectedDate}
          workerId={profile.id}
          clients={clients}
          saleTypes={saleTypes}
          selectedDayLabel={selectedDayLabel}
          selectedDayEntries={selectedDayEntries}
          selectedDayReadOnly={selectedDayReadOnly}
          onEntryAdded={handleEntryAdded}
          onEntryDeleted={handleEntryDeleted}
          onCloseDayModal={() => setSelectedDate(null)}
        />
      )}

      {activeTab === 'submitCustomerOrder' && (
        <SubmitCustomerOrderTab
          workerId={profile.id}
          workerName={profile.full_name}
          weekStart={weekStart}
          weekEnd={weekEnd}
          entries={weekEntries}
          clients={clients}
          saleTypes={saleTypes}
          customerOrders={customerOrders}
          showLastWeek={showLastWeekPanel}
          previousWeekStart={previousWeek.weekStart}
          previousWeekEnd={previousWeek.weekEnd}
          previousEntries={previousWeekEntries}
          onOrderSaved={handleOrderSaved}
        />
      )}

      {activeTab === 'workTimetable' && <WorkTimetableTab workerId={profile.id} clients={clients} />}

      {activeTab === 'paymentDetails' && (
        <PaymentDetailsTab paymentDetails={paymentDetails} onSave={handleSavePaymentDetails} />
      )}

      {missingOrderRows && (
        <MissingCustomerOrdersModal
          rows={missingOrderRows}
          clients={clients}
          onGoToSubmitCustomerOrder={() => {
            setActiveTab('submitCustomerOrder')
            setMissingOrderRows(null)
          }}
          onClose={() => setMissingOrderRows(null)}
        />
      )}
    </div>
  )
}
