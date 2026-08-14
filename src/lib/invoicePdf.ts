import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcOwnerCut } from './earnings'
import type { OwnerSubmission, SaleEntry, SaleType } from '../types'

function formatUsd(usdAmount: number): string {
  return `$${usdAmount.toFixed(2)}`
}

function formatGbp(usdAmount: number, rate: number): string {
  return `£${(usdAmount * rate).toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PINK: [number, number, number] = [233, 114, 156]
const PINK_LIGHT: [number, number, number] = [255, 229, 238]
const INK: [number, number, number] = [30, 30, 30]
const INK_MUTED: [number, number, number] = [110, 110, 110]

/** Draws a small 4-point sparkle (two overlapping diamonds) - the accent next to the PS Management wordmark. */
function drawSparkle(doc: jsPDF, cx: number, cy: number, size: number): void {
  doc.setFillColor(...PINK)
  const long = size
  const short = size * 0.32
  // Vertical diamond.
  doc.triangle(cx, cy - long, cx + short, cy, cx, cy + long, 'F')
  doc.triangle(cx, cy - long, cx - short, cy, cx, cy + long, 'F')
  // Horizontal diamond.
  const long2 = size * 0.55
  const short2 = size * 0.18
  doc.triangle(cx - long2, cy, cx, cy - short2, cx + long2, cy, 'F')
  doc.triangle(cx - long2, cy, cx, cy + short2, cx + long2, cy, 'F')
}

/** Draws a filled pink circle with a white envelope glyph inside it. */
function drawEmailIcon(doc: jsPDF, cx: number, cy: number, r: number): void {
  doc.setFillColor(...PINK)
  doc.circle(cx, cy, r, 'F')

  const w = r * 1.3
  const h = r * 0.9
  const left = cx - w / 2
  const top = cy - h / 2
  doc.setFillColor(255, 255, 255)
  doc.rect(left, top, w, h, 'F')

  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.35)
  doc.line(left, top, cx, top + h * 0.55)
  doc.line(cx, top + h * 0.55, left + w, top)
}

/** Draws a filled pink circle with a white paper-plane glyph inside it. */
function drawTelegramIcon(doc: jsPDF, cx: number, cy: number, r: number): void {
  doc.setFillColor(...PINK)
  doc.circle(cx, cy, r, 'F')

  doc.setFillColor(255, 255, 255)
  doc.triangle(cx - r * 0.6, cy + r * 0.35, cx + r * 0.65, cy - r * 0.05, cx - r * 0.05, cy + r * 0.05, 'F')
  doc.triangle(cx - r * 0.05, cy + r * 0.05, cx + r * 0.65, cy - r * 0.05, cx - r * 0.25, cy + r * 0.55, 'F')
}

/** Draws a label above a bold value above a pink underline - the invoice's Invoice Number/Date Issued/Bill to/Date Due fields. */
function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_MUTED)
  doc.text(label, x, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(value || '—', x, y + 7)
  doc.setFont('helvetica', 'normal')

  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.4)
  doc.line(x, y + 10, x + width, y + 10)
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
    headStyles: { fillColor: [233, 114, 156] },
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
    headStyles: { fillColor: [233, 114, 156] },
  })
  return lastAutoTableY(doc) + 8
}

/**
 * PS Management-branded invoice PDF: page one is the client-facing invoice (Invoice
 * Number/Date Issued/Bill to/Date Due, the client's payment method, and a Service
 * Description/Total (USD)/Total (GBP) summary table) modelled on the owner's Canva
 * template; page two lists the contractor Sexting/Customs entries broken down by day
 * (an Unlocks & Tips table plus a Customs table per day), and page three lists the
 * owner's own submissions split into a Purchases table (Subscriptions and Livestreams
 * categories) and a Tips table - internal reference pages, not shown to the client.
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
  invoiceNumber: number
  dateIssuedIso: string
  dateDueIso: string
  billToName: string
  paymentMethodLabel: string | null
  paymentMethodLines: string[]
}): void {
  const { exchangeRate: rate } = input
  const doc = new jsPDF()

  // Page one - the client-facing invoice.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...PINK)
  doc.text('INVOICE', 14, 26)

  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  doc.text('PS', 196, 20, { align: 'right' })
  drawSparkle(doc, 198, 9, 2.4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('M A N A G E M E N T', 196, 26, { align: 'right' })
  doc.setTextColor(...INK)

  drawField(doc, 'Invoice Number:', `#${input.invoiceNumber}`, 14, 46, 85)
  drawField(doc, 'Date Issued:', formatDate(input.dateIssuedIso), 110, 46, 86)
  drawField(doc, 'Bill to:', input.billToName, 14, 64, 85)
  drawField(doc, 'Date Due:', formatDate(input.dateDueIso), 110, 64, 86)

  doc.setFontSize(9)
  doc.setTextColor(...INK_MUTED)
  doc.text('Payment Method:', 14, 82)

  let pmY = 89
  if (input.paymentMethodLabel) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(input.paymentMethodLabel, 14, pmY)
    pmY += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK_MUTED)
    for (const line of input.paymentMethodLines) {
      doc.text(line, 14, pmY)
      pmY += 5
    }
  } else {
    doc.setFontSize(10)
    doc.setTextColor(...INK_MUTED)
    doc.text('Not set', 14, pmY)
    pmY += 6
  }

  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.4)
  doc.line(14, pmY + 2, 196, pmY + 2)

  autoTable(doc, {
    startY: pmY + 10,
    head: [['Service Description', 'Total (USD)', 'Total (GBP)']],
    body: [
      ['Sexting Sales & Customs', formatUsd(input.clientInvoiceOwnerCut), formatGbp(input.clientInvoiceOwnerCut, rate)],
      ['PPV Purchases & Tips', formatUsd(input.ownerSubmissionsCut), formatGbp(input.ownerSubmissionsCut, rate)],
    ],
    foot: [['Total', formatUsd(input.combinedOwnerCut), formatGbp(input.combinedOwnerCut, rate)]],
    columnStyles: { 0: { cellWidth: 100 } },
    styles: { fontSize: 10, textColor: INK },
    headStyles: { fillColor: PINK_LIGHT, textColor: INK, fontStyle: 'bold' },
    footStyles: { fillColor: PINK_LIGHT, textColor: INK, fontStyle: 'bold' },
  })

  const afterTableY = lastAutoTableY(doc)

  doc.setFillColor(...PINK_LIGHT)
  doc.setDrawColor(...PINK)
  doc.rect(110, afterTableY + 8, 86, 12, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(`Total Owed: ${formatGbp(input.combinedOwnerCut, rate)}`, 114, afterTableY + 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...PINK)
  doc.text('THANK YOU!', 14, afterTableY + 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(`Converted at $1 = £${rate.toFixed(4)} (rate on ${input.exchangeRateDate})`, 14, afterTableY + 44)

  doc.setFontSize(10)
  const contactIconRadius = 3.2
  const contactY1 = afterTableY + 55
  const contactY2 = afterTableY + 64
  drawEmailIcon(doc, 14 + contactIconRadius, contactY1 - 1.3, contactIconRadius)
  doc.text('contact@psmanagementltd.co.uk', 14 + contactIconRadius * 2 + 4, contactY1)
  drawTelegramIcon(doc, 14 + contactIconRadius, contactY2 - 1.3, contactIconRadius)
  doc.text('Telegram: @PSManagementx', 14 + contactIconRadius * 2 + 4, contactY2)

  // Page two - contractor entries (Sexting/Customs), grouped by day, oldest first.
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Sexting Sales', 14, 20)
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
  doc.text('PPV purchase and tips', 14, 20)
  let y3 = 20

  y3 = renderCategoryTable(doc, 'Purchases', purchaseRows, 'No purchases recorded for this client this week.', y3)
  renderCategoryTable(doc, 'Tips', tipRows, 'No tips recorded for this client this week.', y3)

  doc.save(`owner-invoice-${input.clientName.replace(/\s+/g, '-').toLowerCase()}-${input.weekStart}.pdf`)
}
