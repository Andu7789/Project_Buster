import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUrl from '../assets/invoice/ps-management-logo.png'
import thankYouUrl from '../assets/invoice/ps-management-thankyou.jpg'
import { calcOwnerCut, ownerSubmissionCategoryLabel } from './earnings'
import type { OwnerSubmission, SaleEntry, SaleType, ServiceInvoiceLineItem } from '../types'

const LOGO_ASPECT = 1254 / 1254
const THANK_YOU_ASPECT = 607 / 380

/** Resolves a Vite asset import (a data: URI if inlined, otherwise a URL) to a data: URI jsPDF's addImage can embed. */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function formatUsd(usdAmount: number): string {
  return `$${usdAmount.toFixed(2)}`
}

function formatGbp(usdAmount: number, rate: number): string {
  return `£${(usdAmount * rate).toFixed(2)}`
}

function formatGbpAmount(gbpAmount: number): string {
  return `£${gbpAmount.toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PINK: [number, number, number] = [233, 114, 156]
const PINK_LIGHT: [number, number, number] = [255, 229, 238]
const INK: [number, number, number] = [30, 30, 30]
const INK_MUTED: [number, number, number] = [110, 110, 110]

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

function toDailyRow(entry: SaleEntry, saleTypes: SaleType[], sextingOwnerPercent: number, customsOwnerPercent: number): DailyEntryRow {
  const saleType = saleTypes.find((type) => type.id === entry.sale_type_id)
  const ownerCutPercent = entry.section === 'sexting' ? sextingOwnerPercent : customsOwnerPercent
  return {
    date: entry.entry_date,
    user: entry.buyer_username,
    type: saleType?.label ?? 'Unknown type',
    gross: entry.gross,
    net: entry.net,
    earnings: calcOwnerCut(entry.net, ownerCutPercent),
  }
}

function dailyRowsToBody(rows: DailyEntryRow[]): string[][] {
  return rows.map((row) => [row.date, row.user, row.type, formatUsd(row.gross), formatUsd(row.net), formatUsd(row.earnings)])
}

function ownerSubmissionToDailyRow(entry: OwnerSubmission, typeLabel: string): DailyEntryRow {
  return { date: entry.entry_date, user: entry.buyer_username, type: typeLabel, gross: entry.gross, net: entry.net, earnings: entry.owner_cut }
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
 * (an Unlocks & Tips table, which also folds in the owner's own Paige sexting / Alex
 * sexting entries for that day, plus a Customs table per day - same "Sexting Sales &
 * Customs" total as page one); page three lists the owner's remaining submissions split
 * into a Purchases table (Subscriptions and Livestreams categories) and a Tips table -
 * internal reference pages, not shown to the client.
 */
export async function generateOwnerInvoicePdf(input: {
  clientName: string
  weekStart: string
  weekEnd: string
  ownerSubmissionsCut: number
  clientInvoiceOwnerCut: number
  combinedOwnerCut: number
  saleEntries: SaleEntry[]
  saleTypes: SaleType[]
  sextingOwnerPercent: number
  customsOwnerPercent: number
  ownerSubmissions: OwnerSubmission[]
  sextingOwnerSubmissions: OwnerSubmission[]
  exchangeRate: number
  exchangeRateDate: string
  invoiceNumber: number
  dateIssuedIso: string
  dateDueIso: string
  billToName: string
  paymentMethodLabel: string | null
  paymentMethodLines: string[]
}): Promise<void> {
  const { exchangeRate: rate } = input
  const [logoDataUrl, thankYouDataUrl] = await Promise.all([toDataUrl(logoUrl), toDataUrl(thankYouUrl)])
  const doc = new jsPDF()

  // Page one - the client-facing invoice.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...PINK)
  doc.text('INVOICE', 14, 26)

  const logoHeight = 26 * 1.25 * 1.25
  const logoWidth = logoHeight * LOGO_ASPECT
  doc.addImage(logoDataUrl, 'PNG', 196 - logoWidth, 4, logoWidth, logoHeight)
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
  const thankYouImgY = afterTableY + 10
  const thankYouImgWidth = 95 * 0.75
  const thankYouImgHeight = thankYouImgWidth / THANK_YOU_ASPECT
  doc.addImage(thankYouDataUrl, 'JPEG', 14, thankYouImgY, thankYouImgWidth, thankYouImgHeight)

  const totalOwedCenterY = thankYouImgY + thankYouImgHeight * 0.19

  doc.setFillColor(...PINK_LIGHT)
  doc.setDrawColor(...PINK)
  doc.rect(110, totalOwedCenterY - 6, 86, 12, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(`Total Owed: ${formatGbp(input.combinedOwnerCut, rate)}`, 114, totalOwedCenterY + 2)

  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.35)
  doc.line(110, totalOwedCenterY + 16, 196, totalOwedCenterY + 16)
  doc.line(110, totalOwedCenterY + 22, 196, totalOwedCenterY + 22)
  doc.line(110, totalOwedCenterY + 28, 196, totalOwedCenterY + 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(`Converted at $1 = £${rate.toFixed(4)} (rate on ${input.exchangeRateDate})`, 14, thankYouImgY + thankYouImgHeight + 8)

  // Page two - contractor Sexting/Customs entries plus the owner's own Paige/Alex sexting
  // entries, all grouped together by day, oldest first.
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Sexting Sales', 14, 20)
  let y2 = 20

  const entriesByDate = new Map<string, SaleEntry[]>()
  for (const entry of input.saleEntries) {
    const list = entriesByDate.get(entry.entry_date) ?? []
    list.push(entry)
    entriesByDate.set(entry.entry_date, list)
  }
  const ownerSextingByDate = new Map<string, OwnerSubmission[]>()
  for (const entry of input.sextingOwnerSubmissions) {
    const list = ownerSextingByDate.get(entry.entry_date) ?? []
    list.push(entry)
    ownerSextingByDate.set(entry.entry_date, list)
  }
  const dates = Array.from(new Set([...entriesByDate.keys(), ...ownerSextingByDate.keys()])).sort((a, b) => a.localeCompare(b))

  if (dates.length === 0) {
    doc.setFontSize(10)
    doc.text('No contractor entries recorded for this client this week.', 14, y2 + 8)
  } else {
    for (const date of dates) {
      const dayEntries = entriesByDate.get(date) ?? []
      const unlockTipRows = dayEntries
        .filter((entry) => entry.section === 'sexting')
        .map((entry) => toDailyRow(entry, input.saleTypes, input.sextingOwnerPercent, input.customsOwnerPercent))
      const customRows = dayEntries
        .filter((entry) => entry.section === 'customs')
        .map((entry) => toDailyRow(entry, input.saleTypes, input.sextingOwnerPercent, input.customsOwnerPercent))
      const ownerSextingRows = (ownerSextingByDate.get(date) ?? []).map((entry) =>
        ownerSubmissionToDailyRow(entry, ownerSubmissionCategoryLabel[entry.category]),
      )

      y2 = ensureSpace(doc, y2, 16)
      doc.setFontSize(12)
      doc.text(date, 14, y2 + 10)
      y2 += 14

      y2 = renderDailyTable(doc, 'Unlocks & Tips', [...unlockTipRows, ...ownerSextingRows], y2)
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

/** The business name a worker's invoice is addressed to - fixed, matches the paper template this mirrors. */
const CONTRACTOR_INVOICE_RECIPIENT = 'Savannah Assistant Services'

/**
 * A worker's own weekly invoice PDF - generated client-side when they submit
 * their timesheet (so they have a copy for their own records) and re-downloadable
 * later from either the worker's or owner's invoice history. Wording and field
 * order mirror the paper subcontractor-invoice template this replaces.
 * Deliberately plain compared to generateOwnerInvoicePdf() above - no branding
 * assets, just the figures the worker already sees on-screen.
 */
export async function generateWorkerInvoicePdf(input: {
  workerName: string
  weekStart: string
  weekEnd: string
  invoiceNumber: number
  dateIssuedIso: string
  dateDueIso: string
  clientTotals: { clientName: string; earnings: number }[]
  amount: number
  paymentMethodLabel: string | null
  paymentMethodLines: string[]
}): Promise<void> {
  const doc = new jsPDF()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...PINK)
  doc.text('INVOICE', 14, 24)
  doc.setTextColor(...INK)

  drawField(doc, 'From:', input.workerName, 14, 42, 85)
  drawField(doc, 'To:', CONTRACTOR_INVOICE_RECIPIENT, 110, 42, 86)

  drawField(doc, 'Invoice Number:', `#${input.invoiceNumber}`, 14, 60, 56)
  drawField(doc, 'Invoice Date:', formatDate(input.dateIssuedIso), 76, 60, 56)
  drawField(doc, 'Payment Due:', formatDate(input.dateDueIso), 140, 60, 56)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('Description of Services', 14, 86)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_MUTED)
  doc.text(`Administrative support services provided to ${CONTRACTOR_INVOICE_RECIPIENT}`, 14, 93)
  doc.text(`For the period: ${formatDate(input.weekStart)} - ${formatDate(input.weekEnd)}`, 14, 99)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('Earnings by client', 14, 113)

  let y: number
  if (input.clientTotals.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK_MUTED)
    doc.text('No entries recorded for this period.', 14, 120)
    y = 128
  } else {
    autoTable(doc, {
      startY: 118,
      head: [['Client', 'Amount']],
      body: input.clientTotals.map((row) => [row.clientName, formatUsd(row.earnings)]),
      styles: { fontSize: 10, textColor: INK },
      headStyles: { fillColor: PINK_LIGHT, textColor: INK, fontStyle: 'bold' },
    })
    y = lastAutoTableY(doc) + 10
  }

  y = ensureSpace(doc, y, 16)
  doc.setFillColor(...PINK_LIGHT)
  doc.setDrawColor(...PINK)
  doc.rect(14, y - 6, 182, 12, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(`Total amount due to Contractor: ${formatUsd(input.amount)}`, 18, y + 2)
  y += 20

  y = ensureSpace(doc, y, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Payment Details', 14, y)
  y += 8

  doc.setFontSize(9)
  if (input.paymentMethodLabel) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(input.paymentMethodLabel, 14, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK_MUTED)
    for (const line of input.paymentMethodLines) {
      doc.text(line, 14, y)
      y += 5
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK_MUTED)
    doc.text('Not set', 14, y)
    y += 6
  }

  y = ensureSpace(doc, y, 18)
  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.35)
  doc.line(14, y + 4, 196, y + 4)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...INK_MUTED)
  doc.text('This invoice represents subcontracted services under agreement.', 14, y + 11)

  doc.save(`${input.workerName.replace(/\s+/g, '-')}-Invoice-${input.invoiceNumber}.pdf`)
}

/**
 * A standalone GG Swaps/SFS/admin-services invoice PDF - same branded header/footer as
 * generateOwnerInvoicePdf's page one, but GBP-only (these customers are never billed in USD)
 * and a free-form list of line items instead of the fixed Sexting/PPV two-row breakdown.
 */
export async function generateServiceInvoicePdf(input: {
  invoiceNumber: number
  dateIssuedIso: string
  dateDueIso: string
  billToName: string
  lineItems: ServiceInvoiceLineItem[]
  totalGbp: number
}): Promise<void> {
  const [logoDataUrl, thankYouDataUrl] = await Promise.all([toDataUrl(logoUrl), toDataUrl(thankYouUrl)])
  const doc = new jsPDF()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...PINK)
  doc.text('INVOICE', 14, 26)

  const logoHeight = 26 * 1.25 * 1.25
  const logoWidth = logoHeight * LOGO_ASPECT
  doc.addImage(logoDataUrl, 'PNG', 196 - logoWidth, 4, logoWidth, logoHeight)
  doc.setTextColor(...INK)

  drawField(doc, 'Invoice Number:', `#${input.invoiceNumber}`, 14, 46, 85)
  drawField(doc, 'Date Issued:', formatDate(input.dateIssuedIso), 110, 46, 86)
  drawField(doc, 'Bill to:', input.billToName, 14, 64, 85)
  drawField(doc, 'Date Due:', formatDate(input.dateDueIso), 110, 64, 86)

  autoTable(doc, {
    startY: 82,
    head: [['Service Description', 'Total (GBP)']],
    body: input.lineItems.map((item) => [item.description, formatGbpAmount(item.amountGbp)]),
    foot: [['Total', formatGbpAmount(input.totalGbp)]],
    columnStyles: { 0: { cellWidth: 140 } },
    styles: { fontSize: 10, textColor: INK },
    headStyles: { fillColor: PINK_LIGHT, textColor: INK, fontStyle: 'bold' },
    footStyles: { fillColor: PINK_LIGHT, textColor: INK, fontStyle: 'bold' },
  })

  const afterTableY = lastAutoTableY(doc)
  const thankYouImgY = afterTableY + 10
  const thankYouImgWidth = 95 * 0.75
  const thankYouImgHeight = thankYouImgWidth / THANK_YOU_ASPECT
  doc.addImage(thankYouDataUrl, 'JPEG', 14, thankYouImgY, thankYouImgWidth, thankYouImgHeight)

  const totalOwedCenterY = thankYouImgY + thankYouImgHeight * 0.19

  doc.setFillColor(...PINK_LIGHT)
  doc.setDrawColor(...PINK)
  doc.rect(110, totalOwedCenterY - 6, 86, 12, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(`Total Owed: ${formatGbpAmount(input.totalGbp)}`, 114, totalOwedCenterY + 2)

  doc.setDrawColor(...PINK)
  doc.setLineWidth(0.35)
  doc.line(110, totalOwedCenterY + 16, 196, totalOwedCenterY + 16)
  doc.line(110, totalOwedCenterY + 22, 196, totalOwedCenterY + 22)
  doc.line(110, totalOwedCenterY + 28, 196, totalOwedCenterY + 28)

  doc.save(`service-invoice-${input.invoiceNumber}.pdf`)
}
