import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  addRequestComment,
  createRequest,
  getScreenshotSignedUrls,
  listAllRequestComments,
  listDevelopers,
  listRequestsForOwner,
  notifyTelegram,
  uploadRequestScreenshots,
} from '../../data/queries'
import type { DevRequest, Profile, RequestComment, RequestPriority, RequestType } from '../../types'
import { RequestCard } from '../../components/RequestCard'
import { ScreenshotLightbox } from '../../components/ScreenshotLightbox'

const typeOptions: { value: RequestType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature idea' },
  { value: 'billing', label: 'Charge request' },
]

const priorityOptions: { value: RequestPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function RequestsTab({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<DevRequest[]>([])
  const [comments, setComments] = useState<RequestComment[]>([])
  const [developers, setDevelopers] = useState<Profile[]>([])
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const [type, setType] = useState<RequestType>('bug')
  const [priority, setPriority] = useState<RequestPriority>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listRequestsForOwner(profile.id), listAllRequestComments(), listDevelopers()])
      .then(async ([requestData, commentData, developerData]) => {
        if (cancelled) return
        setRequests(requestData)
        setComments(commentData)
        setDevelopers(developerData)
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
  }, [profile.id])

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
    const developer = developers.find((entry) => entry.id === authorId)
    return developer ? developer.full_name : 'Developer'
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    if (!trimmedTitle || !trimmedDescription) {
      setFormError('Enter a title and description.')
      return
    }

    setSubmitting(true)
    try {
      const screenshotPaths = files.length > 0 ? await uploadRequestScreenshots(profile.id, files) : []
      const created = await createRequest({
        createdBy: profile.id,
        type,
        title: trimmedTitle,
        description: trimmedDescription,
        priority,
        screenshotPaths,
      })
      setRequests((previous) => [created, ...previous])

      if (screenshotPaths.length > 0) {
        const urls = await getScreenshotSignedUrls(screenshotPaths)
        setScreenshotUrls((previous) => ({ ...previous, ...urls }))
      }

      setTitle('')
      setDescription('')
      setFiles([])
      setType('bug')
      setPriority('medium')
      if (fileInputRef.current) fileInputRef.current.value = ''

      void notifyTelegram('request_created', {
        requestId: created.id,
        requestTitle: created.title,
        requestType: created.type,
        priority: created.priority,
        actorName: profile.full_name,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
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
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Requests & bugs</h2>
          <p>Raise a bug, feature idea, or charge request here instead of messaging the developer directly - they're notified instantly.</p>
        </div>
      </div>

      <form className="request-form stack" onSubmit={handleSubmit}>
        <div className="request-form-row">
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as RequestType)}>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as RequestPriority)}>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Add a bulk-invoice export" />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What do you need, and why?"
          />
        </label>
        <label>
          Screenshots (optional)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(event.target.files ? Array.from(event.target.files) : [])}
          />
        </label>
        {files.length > 0 && (
          <p className="info-text">
            {files.length} file{files.length === 1 ? '' : 's'} selected.
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Raise request'}
        </button>
        {formError && <p className="message message-error">{formError}</p>}
      </form>

      {loading ? (
        <p className="info-text">Loading requests…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : requests.length === 0 ? (
        <p className="info-text">You haven't raised anything yet - use the form above.</p>
      ) : (
        <div className="request-list">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              comments={commentsByRequest.get(request.id) ?? []}
              resolveAuthorName={resolveAuthorName}
              screenshotUrls={screenshotUrls}
              onOpenScreenshot={setLightboxUrl}
              onAddComment={(body) => handleAddComment(request, body)}
            />
          ))}
        </div>
      )}

      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </section>
  )
}
