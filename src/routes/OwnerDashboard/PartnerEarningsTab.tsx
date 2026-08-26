import { useEffect, useMemo, useState } from 'react'
import { listOwnerSubmissionsForRange, listSaleEntriesForRange } from '../../data/queries'
import { formatCurrency, formatWeekRange, getCurrentWeekRange, toISODate } from '../../lib/dates'
import {
  PPV_OWNER_SUBMISSION_CATEGORIES,
  chattingManagementSplitByClient,
  isSavClient,
} from '../../lib/earnings'
import type { Client, OwnerSubmission, SaleEntry } from '../../types'

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const date = new Date(weekStart)
  date.setDate(date.getDate() + deltaWeeks * 7)
  return toISODate(date)
}

export function PartnerEarningsTab({ clients }: { clients: Client[] }) {
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekRange().weekStart)
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    return toISODate(end)
  }, [weekStart])

  const [entries, setEntries] = useState<SaleEntry[]>([])
  const [ownerSubmissions, setOwnerSubmissions] = useState<OwnerSubmission[]>([])
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const loading = loadedWeek !== weekStart

  useEffect(() => {
    let cancelled = false
    Promise.all([listSaleEntriesForRange(weekStart, weekEnd), listOwnerSubmissionsForRange(weekStart, weekEnd)])
      .then(([entryData, ownerSubmissionData]) => {
        if (cancelled) return
        setEntries(entryData)
        setOwnerSubmissions(ownerSubmissionData)
        setLoadError(null)
        setLoadedWeek(weekStart)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load this week.')
        setLoadedWeek(weekStart)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, weekEnd])

  const chattingRows = useMemo(() => chattingManagementSplitByClient(entries, clients), [entries, clients])
  const clientChattingPaige = chattingRows.reduce((sum, row) => sum + row.paigeShare, 0)
  const clientChattingAlex = chattingRows.reduce((sum, row) => sum + row.alexShare, 0)

  // Paige sexting / Alex sexting owner submissions are entered directly (via PM Sales) rather
  // than split 50/50 from a worker's client sale entry - each goes 100% to the named partner.
  const paigeDirectSexting = ownerSubmissions
    .filter((entry) => entry.category === 'paige_sexting')
    .reduce((sum, entry) => sum + entry.owner_cut, 0)
  const alexDirectSexting = ownerSubmissions
    .filter((entry) => entry.category === 'alex_sexting')
    .reduce((sum, entry) => sum + entry.owner_cut, 0)

  const chattingManagementPaige = clientChattingPaige + paigeDirectSexting
  const chattingManagementAlex = clientChattingAlex + alexDirectSexting
  const chattingManagementTotal = chattingManagementPaige + chattingManagementAlex

  // Only subscriptions/tips/livestreams count as "PM sales" here - paige_sexting/alex_sexting
  // owner submissions are already accounted for above (see PPV_OWNER_SUBMISSION_CATEGORIES).
  const pmSalesTotal = ownerSubmissions
    .filter((entry) => PPV_OWNER_SUBMISSION_CATEGORIES.includes(entry.category))
    .reduce((sum, entry) => sum + entry.owner_cut, 0)
  const pmSalesPaige = pmSalesTotal / 2
  const pmSalesAlex = pmSalesTotal / 2

  const paigeGrandTotal = chattingManagementPaige + pmSalesPaige
  const alexGrandTotal = chattingManagementAlex + pmSalesAlex

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Alex & Paige Earnings</h2>
          <p>{formatWeekRange(weekStart, weekEnd)} — chatting management and PM sales commission, split between Alex and Paige.</p>
        </div>
        <div className="calendar-nav">
          <button type="button" className="btn-outline" onClick={() => setWeekStart((current) => shiftWeek(current, -1))}>
            ‹ Prev week
          </button>
          <strong>{formatWeekRange(weekStart, weekEnd)}</strong>
          <button type="button" className="btn-outline" onClick={() => setWeekStart((current) => shiftWeek(current, 1))}>
            Next week ›
          </button>
          <button type="button" className="btn-outline" onClick={() => setWeekStart(getCurrentWeekRange().weekStart)}>
            This week
          </button>
        </div>
      </div>

      {loading ? (
        <p className="info-text">Loading…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <h4 className="detail-summary-heading">Chatting management earnings (sexting + customs)</h4>
          <div className="detail-summary">
            <div>
              <p className="label">Company total</p>
              <strong>{formatCurrency(chattingManagementTotal)}</strong>
            </div>
            <div>
              <p className="label">Paige</p>
              <strong>{formatCurrency(chattingManagementPaige)}</strong>
            </div>
            <div>
              <p className="label">Alex</p>
              <strong>{formatCurrency(chattingManagementAlex)}</strong>
            </div>
          </div>

          <h4 className="detail-summary-heading">PM sales (purchases, tips & customs submitted directly)</h4>
          <div className="detail-summary">
            <div>
              <p className="label">Company total</p>
              <strong>{formatCurrency(pmSalesTotal)}</strong>
            </div>
            <div>
              <p className="label">Paige (50%)</p>
              <strong>{formatCurrency(pmSalesPaige)}</strong>
            </div>
            <div>
              <p className="label">Alex (50%)</p>
              <strong>{formatCurrency(pmSalesAlex)}</strong>
            </div>
          </div>

          <h4 className="detail-summary-heading">Sexting commission by client</h4>
          <div className="table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Paige sexting</th>
                  <th>Alex sexting</th>
                </tr>
              </thead>
              <tbody>
                {chattingRows.map((row) => (
                  <tr key={row.clientName}>
                    <td>
                      {row.clientName}
                      {isSavClient(row.clientName) && <span className="info-text"> (100% to Alex)</span>}
                    </td>
                    <td>{formatCurrency(isSavClient(row.clientName) ? 0 : row.sexting / 2)}</td>
                    <td>{formatCurrency(isSavClient(row.clientName) ? row.sexting : row.sexting / 2)}</td>
                  </tr>
                ))}
                {chattingRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-row">
                      No sale entries this week.
                    </td>
                  </tr>
                )}
                <tr>
                  <td>
                    PM Sales — Paige sexting / Alex sexting <span className="info-text">(submitted directly, 100% each)</span>
                  </td>
                  <td>{formatCurrency(paigeDirectSexting)}</td>
                  <td>{formatCurrency(alexDirectSexting)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(chattingManagementPaige)}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(chattingManagementAlex)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="detail-summary-heading">Grand total this week</h4>
          <div className="detail-summary">
            <div>
              <p className="label">Paige</p>
              <strong>{formatCurrency(paigeGrandTotal)}</strong>
            </div>
            <div>
              <p className="label">Alex</p>
              <strong>{formatCurrency(alexGrandTotal)}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
