import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/authContext'
import {
  addRequestComment,
  getScreenshotSignedUrls,
  listAllRequestComments,
  listAllRequests,
  listOwners,
  notifyTelegram,
  updateRequest,
} from '../data/queries'
import type { DevRequest, Profile, RequestComment, RequestStatus } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { StatCard } from '../components/StatCard'
import { RequestCard } from '../components/RequestCard'
import { RequestDevControls } from '../components/RequestDevControls'
import { ScreenshotLightbox } from '../components/ScreenshotLightbox'

type Filter = 'all' | RequestStatus

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'needs_info', label: 'Needs owner input' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
]

export function DeveloperDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const [requests, setRequests] = useState<DevRequest[]>([])
  const [comments, setComments] = useState<RequestComment[]>([])
  const [owners, setOwners] = useState<Profile[]>([])
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listAllRequests(), listAllRequestComments(), listOwners()])
      .then(async ([requestData, commentData, ownerData]) => {
        if (cancelled) return
        setRequests(requestData)
        setComments(commentData)
        setOwners(ownerData)
        const paths = requestData.flatMap((request) => request.screenshot_paths)
        if (paths.length > 0) {
          const urls = await getScreenshotSignedUrls(paths)
          if (!cancelled) setScreenshotUrls(urls)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load requests.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const commentsByRequest = useMemo(() => {
    const map = new Map<string, RequestComment[]>()
    for (const comment of comments) {
      const list = map.get(comment.request_id) ?? []
      list.push(comment)
      map.set(comment.request_id, list)
    }
    return map
  }, [comments])

  function resolveAuthorName(authorId: string): string {
    if (authorId === profile.id) return 'You'
    const owner = owners.find((entry) => entry.id === authorId)
    return owner ? owner.full_name : 'Owner'
  }

  function raisedByLabel(request: DevRequest): string {
    const owner = owners.find((entry) => entry.id === request.created_by)
    return `Raised by ${owner ? owner.full_name : 'the owner'}`
  }

  const counts = useMemo(() => {
    const map = new Map<RequestStatus, number>()
    for (const request of requests) map.set(request.status, (map.get(request.status) ?? 0) + 1)
    return map
  }, [requests])

  const visibleRequests = filter === 'all' ? requests : requests.filter((request) => request.status === filter)

  async function handleSaveUpdate(
    request: DevRequest,
    input: { status: RequestStatus; progress: number; resolutionNotes: string | null },
  ) {
    const updated = await updateRequest(request.id, input)
    setRequests((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)))
    void notifyTelegram('status_changed', {
      requestId: updated.id,
      requestTitle: updated.title,
      status: updated.status,
      progress: updated.progress,
      resolutionNotes: updated.resolution_notes,
      actorName: profile.full_name,
    })
  }

  async function handleAddComment(request: DevRequest, body: string) {
    const created = await addRequestComment({ requestId: request.id, authorId: profile.id, body })
    setComments((previous) => [...previous, created])
    void notifyTelegram('comment_added', {
      requestId: request.id,
      requestTitle: request.title,
      commentBody: body,
      actorName: profile.full_name,
    })
  }

  return (
    <div className="app-shell">
      <PortalHeader portalLabel="Developer portal" userName={profile.full_name} onSignOut={signOut} />

      {loading ? (
        <p className="info-text">Loading dashboard…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <section className="stat-grid">
            <StatCard label="Open" value={String(counts.get('open') ?? 0)} />
            <StatCard label="In progress" value={String(counts.get('in_progress') ?? 0)} />
            <StatCard
              label="Needs your input"
              value={String(counts.get('needs_info') ?? 0)}
              tone={(counts.get('needs_info') ?? 0) > 0 ? 'danger' : 'default'}
            />
            <StatCard label="Completed" value={String(counts.get('completed') ?? 0)} />
          </section>

          <div className="tab-nav" role="tablist">
            {filters.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                className={`tab-nav-btn ${filter === option.id ? 'active' : ''}`}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {visibleRequests.length === 0 ? (
            <p className="info-text">Nothing here.</p>
          ) : (
            <div className="request-list">
              {visibleRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  raisedByLabel={raisedByLabel(request)}
                  comments={commentsByRequest.get(request.id) ?? []}
                  resolveAuthorName={resolveAuthorName}
                  screenshotUrls={screenshotUrls}
                  onOpenScreenshot={setLightboxUrl}
                  onAddComment={(body) => handleAddComment(request, body)}
                  devControls={<RequestDevControls request={request} onSave={(input) => handleSaveUpdate(request, input)} />}
                />
              ))}
            </div>
          )}
        </>
      )}

      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}
