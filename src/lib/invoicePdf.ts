import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatWeekRange } from './dates'
import { calcOwnerCut } from './earnings'
import type { OwnerSubmission, SaleEntry, SaleType } from '../types'

function formatUsd(usdAmount: number): string {
  return `$${usdAmount.toFixed(2)}`
}

function formatGbp(usdAmount: number, rate: number): string {
  return `£${(usdAmount * rate).toFixed(2)}`
}

function lastAutoTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/** Starts a new page if `needed` points of vertical space aren't left on the current one. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 14) {
    doc.addPage()
    return 20
  }
  return y
}

interface CategoryEntryRow {
  date: string
  user: string
  gross: number
  net: number
  earnings: number
}

function categoryRowsToBody(rows: CategoryEntryRow[]): string[][] {
  return rows.map((row) => [row.date, row.user, formatUsd(row.gross), formatUsd(row.net), formatUsd(row.earnings)])
}

/** Renders a titled Date/User/Gross/Net/Earnings table (or an empty-state line), returning the Y position after it. */
function renderCategoryTable(doc: jsPDF, title: string, rows: CategoryEntryRow[], emptyMessage: string, startY: number): number {
  let y = ensureSpace(doc, startY, 16)
  doc.setFontSize(11)
  doc.text(title, 14, y + 8)
  y += 12

  if (rows.length === 0) {
    doc.setFontSize(9)
    doc.text(emptyMessage, 14, y + 6)
    return y + 12
  }

  y = ensureSpace(doc, y, 20)
  autoTable(doc, {
    startY: y,
    head: [['Date', 'User', 'Gross', 'Net', 'Earnings']],
    body: categoryRowsToBody(rows),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [53, 104, 168] },
  })
  return lastAutoTableY(doc) + 10
}

interface DailyEntryRow {
  date: string
  user: string
  type: string
  gross: number
  net: number
  earnings: number
}

function toDailyRow(entry: SaleEntry, saleTypes: SaleType[]): DailyEntryRow {
  const saleType = saleTypes.find((type) => type.id === entry.sale_type_id)
  return {
    date: entry.entry_date,
    user: entry.buyer_username,
    type: saleType?.label ?? 'Unknown type',
    gross: entry.gross,
    net: entry.net,
    earnings: calcOwnerCut(entry.net, entry.section),
  }
}

function dailyRowsToBody(rows: DailyEntryRow[]): string[][] {
  return rows.map((row) => [row.date, row.user, row.type, formatUsd(row.gross), formatUsd(row.net), formatUsd(row.earnings)])
}

/** Renders a titled Date/User/Type/Gross/Net/Earnings table, or nothing if there are no rows for it. */
function renderDailyTable(doc: jsPDF, title: string, rows: DailyEntryRow[], startY: number): number {
  if (rows.length === 0) return startY

  let y = ensureSpace(doc, startY, 20)
  doc.setFontSize(10)
  doc.text(title, 14, y + 6)
  y += 10

  y = ensureSpace(doc, y, 20)
  autoTable(doc, {
    startY: y,
    head: [['Date', 'User', 'Type', 'Gross', 'Net', 'Earnings']],
    body: dailyRowsToBody(rows),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [53, 104, 168] },
  })
  return lastAutoTableY(doc) + 8
}

/**
 * Dummy bank-statement-style invoice PDF: page one is the two headline totals the owner
 * pastes onto their real invoice template; page two lists the contractor Sexting/Customs
 * entries broken down by day (an Unlocks & Tips table plus a Customs table per day), and
 * page three lists the owner's own submissions split into a Purchases table (Subscriptions
 * and Livestreams categories) and a Tips table - a placeholder until the owner supplies the
 * actual template to style.
 */
export function generateOwnerInvoicePdf(input: {
  clientName: string
  weekStart: string
  weekEnd: string
  ownerSubmissionsCut: number
  clientInvoiceOwnerCut: number
  combinedOwnerCut: number
  saleEntries: SaleEntry[]
  saleTypes: SaleType[]
  ownerSubmissions: OwnerSubmission[]
  exchangeRate: number
  exchangeRateDate: string
}): void {
  const { exchangeRate: rate } = input
  const weekLabel = formatWeekRange(input.weekStart, input.weekEnd)
  const doc = new jsPDF()

  // Page one - the two headline totals.
  doc.setFontSize(18)
  doc.text('Owner Invoice (dummy)', 14, 20)
  doc.setFontSize(12)
  doc.text(`${input.clientName} — ${weekLabel}`, 14, 28)
  doc.setFontSize(9)
  doc.text(`Converted at $1 = £${rate.toFixed(4)} (rate on ${input.exchangeRateDate})`, 14, 34)

  autoTable(doc, {
    startY: 40,
    head: [['', 'USD', 'GBP']],
    body: [
      ['Owner submissions cut', formatUsd(input.ownerSubmissionsCut), formatGbp(input.ownerSubmissionsCut, rate)],
      ['Client invoice owner cut', formatUsd(input.clientInvoiceOwnerCut), formatGbp(input.clientInvoiceOwnerCut, rate)],
    ],
    styles: { fontSize: 11 },
    headStyles: { fillColor: [53, 104, 168] },
  })

  const afterTotalsY = lastAutoTableY(doc)
  doc.setFontSize(14)
  doc.text(
    `Combined owner cut: ${formatUsd(input.combinedOwnerCut)} / ${formatGbp(input.combinedOwnerCut, rate)}`,
    14,
    afterTotalsY + 12,
  )

  // Page two - contractor entries (Sexting/Customs), grouped by day, oldest first.
  doc.addPage()
  doc.setFontSize(14)
  doc.text(`Sexting Customs — ${input.clientName}`, 14, 20)
  let y2 = 20

  if (input.saleEntries.length === 0) {
    doc.setFontSize(10)
    doc.text('No contractor entries recorded for this client this week.', 14, y2 + 8)
  } else {
    const entriesByDate = new Map<string, SaleEntry[]>()
    for (const entry of input.saleEntries) {
      const list = entriesByDate.get(entry.entry_date) ?? []
      list.push(entry)
      entriesByDate.set(entry.entry_date, list)
    }
    const dates = Array.from(entriesByDate.keys()).sort((a, b) => a.localeCompare(b))

    for (const date of dates) {
      const dayEntries = entriesByDate.get(date)!
      const unlockTipRows = dayEntries.filter((entry) => entry.section === 'sexting').map((entry) => toDailyRow(entry, input.saleTypes))
      const customRows = dayEntries.filter((entry) => entry.section === 'customs').map((entry) => toDailyRow(entry, input.saleTypes))

      y2 = ensureSpace(doc, y2, 16)
      doc.setFontSize(12)
      doc.text(date, 14, y2 + 10)
      y2 += 14

      y2 = renderDailyTable(doc, 'Unlocks & Tips', unlockTipRows, y2)
      y2 = renderDailyTable(doc, 'Customs', customRows, y2)
      y2 += 4
    }
  }

  // Page three - owner submissions, split into Purchases (Subscriptions/Livestreams) and Tips.
  const purchaseRows: CategoryEntryRow[] = input.ownerSubmissions
    .filter((entry) => entry.category !== 'tips')
    .map((entry) => ({ date: entry.entry_date, user: entry.buyer_username, gross: entry.gross, net: entry.net, earnings: entry.owner_cut }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const tipRows: CategoryEntryRow[] = input.ownerSubmissions
    .filter((entry) => entry.category === 'tips')
    .map((entry) => ({ date: entry.entry_date, user: entry.buyer_username, gross: entry.gross, net: entry.net, earnings: entry.owner_cut }))
    .sort((a, b) => a.date.localeCompare(b.date))

  doc.addPage()
  doc.setFontSize(14)
  doc.text(`PPV purchase and tips — ${input.clientName}`, 14, 20)
  let y3 = 20

  y3 = renderCategoryTable(doc, 'Purchases', purchaseRows, 'No purchases recorded for this client this week.', y3)
  renderCategoryTable(doc, 'Tips', tipRows, 'No tips recorded for this client this week.', y3)

  doc.save(`owner-invoice-${input.clientName.replace(/\s+/g, '-').toLowerCase()}-${input.weekStart}.pdf`)
}
