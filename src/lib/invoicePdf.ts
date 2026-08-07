import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatWeekRange } from './dates'
import { calcOwnerCut, ownerSubmissionCategoryLabel, sectionLabel } from './earnings'
import type { OwnerSubmission, SaleEntry, SaleType } from '../types'

function formatGbp(usdAmount: number, rate: number): string {
  return `£${(usdAmount * rate).toFixed(2)}`
}

interface BreakdownRow {
  date: string
  category: string
  description: string
  gross: number
  net: number
  ownerCut: number
}

/**
 * Dummy bank-statement-style invoice PDF: page one is the two headline totals the owner
 * pastes onto their real invoice template; page two lists the contractor Sexting/Customs
 * entries and page three lists the owner's own Subscriptions/Tips/Livestreams submissions,
 * kept as separate tables (one line per transaction, oldest first) rather than merged -
 * a placeholder until the owner supplies the actual template to style.
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
    head: [['', 'Amount']],
    body: [
      ['Owner submissions cut', formatGbp(input.ownerSubmissionsCut, rate)],
      ['Client invoice owner cut', formatGbp(input.clientInvoiceOwnerCut, rate)],
    ],
    styles: { fontSize: 11 },
    headStyles: { fillColor: [53, 104, 168] },
  })

  const afterTotalsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(14)
  doc.text(`Combined owner cut: ${formatGbp(input.combinedOwnerCut, rate)}`, 14, afterTotalsY + 12)

  // Page two - contractor entries (Sexting/Customs), one line per transaction, oldest first.
  const saleRows: BreakdownRow[] = input.saleEntries
    .map((entry) => {
      const saleType = input.saleTypes.find((type) => type.id === entry.sale_type_id)
      return {
        date: entry.entry_date,
        category: sectionLabel[entry.section],
        description: `${entry.buyer_username} — ${saleType?.label ?? 'Unknown type'}`,
        gross: entry.gross,
        net: entry.net,
        ownerCut: calcOwnerCut(entry.net, entry.section),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  doc.addPage()
  doc.setFontSize(14)
  doc.text(`Contractor entries (Sexting/Customs) — ${input.clientName}`, 14, 20)

  if (saleRows.length === 0) {
    doc.setFontSize(10)
    doc.text('No contractor entries recorded for this client this week.', 14, 28)
  } else {
    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Category', 'Description', 'Gross', 'Net', 'Owner cut']],
      body: rowsToBody(saleRows, rate),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [53, 104, 168] },
    })
  }

  // Page three - owner submissions (Subscriptions/Tips/Livestreams), same shape, kept separate.
  const ownerSubmissionRows: BreakdownRow[] = input.ownerSubmissions
    .map((entry) => ({
      date: entry.entry_date,
      category: ownerSubmissionCategoryLabel[entry.category],
      description: entry.buyer_username,
      gross: entry.gross,
      net: entry.net,
      ownerCut: entry.owner_cut,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  doc.addPage()
  doc.setFontSize(14)
  doc.text(`Owner submissions (Subscriptions/Tips/Livestreams) — ${input.clientName}`, 14, 20)

  if (ownerSubmissionRows.length === 0) {
    doc.setFontSize(10)
    doc.text('No owner submissions recorded for this client this week.', 14, 28)
  } else {
    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Category', 'Description', 'Gross', 'Net', 'Owner cut']],
      body: rowsToBody(ownerSubmissionRows, rate),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [53, 104, 168] },
    })
  }

  doc.save(`owner-invoice-${input.clientName.replace(/\s+/g, '-').toLowerCase()}-${input.weekStart}.pdf`)
}

function rowsToBody(rows: BreakdownRow[], rate: number): string[][] {
  return rows.map((row) => [
    row.date,
    row.category,
    row.description,
    formatGbp(row.gross, rate),
    formatGbp(row.net, rate),
    formatGbp(row.ownerCut, rate),
  ])
}
