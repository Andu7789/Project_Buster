import { useState, type FormEvent, type ReactNode } from 'react'
import { formatDateTime } from '../lib/dates'
import { ProgressBar } from './ProgressBar'
import { RequestPriorityBadge, RequestStatusBadge, RequestTypeBadge } from './StatusBadge'
import type { DevRequest, RequestComment } from '../types'

export function RequestCard({
  request,
  raisedByLabel,
  comments,
  resolveAuthorName,
  screenshotUrls,
  onOpenScreenshot,
  onAddComment,
  devControls,
}: {
  request: DevRequest
  raisedByLabel?: string
  comments: RequestComment[]
  resolveAuthorName: (authorId: string) => string
  screenshotUrls: Record<string, string>
  onOpenScreenshot: (url: string) => void
  onAddComment: (body: string) => Promise<void>
  devControls?: ReactNode
}) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReply(event: FormEvent) {
    event.preventDefault()
    const body = reply.trim()
    if (!body) return
    setSending(true)
    setError(null)
    try {
      await onAddComment(body)
      setReply('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your reply.')
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="request-card">
      <div className="request-card-head">
        <div className="request-card-badges">
          <RequestTypeBadge type={request.type} />
          <RequestPriorityBadge priority={request.priority} />
          <RequestStatusBadge status={request.status} />
        </div>
        <span className="request-card-date">{formatDateTime(request.created_at)}</span>
      </div>

      <h3>{request.title}</h3>
      {raisedByLabel && <p className="request-card-raised-by">{raisedByLabel}</p>}
      <p className="request-card-description">{request.description}</p>

      {request.screenshot_paths.length > 0 && (
        <div className="request-screenshot-row">
          {request.screenshot_paths.map((path) =>
            screenshotUrls[path] ? (
              <button
                type="button"
                key={path}
                className="request-screenshot-thumb"
                onClick={() => onOpenScreenshot(screenshotUrls[path])}
              >
                <img src={screenshotUrls[path]} alt="Attached screenshot" />
              </button>
            ) : (
              <div key={path} className="request-screenshot-thumb request-screenshot-thumb-loading" />
            ),
          )}
        </div>
      )}

      <ProgressBar value={request.progress} />

      {request.resolution_notes && (
        <div className="submission-notes">
          <p>
            <strong>{request.status === 'needs_info' ? 'Question from the developer:' : 'Note from the developer:'}</strong>
          </p>
          <p>{request.resolution_notes}</p>
        </div>
      )}

      {devControls}

      <div className="request-comment-thread">
        {comments.length > 0 && (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-row">
                <div className="comment-row-head">
                  <strong>{resolveAuthorName(comment.author_id)}</strong>
                  <span>{formatDateTime(comment.created_at)}</span>
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form className="comment-reply-form" onSubmit={handleReply}>
          <textarea
            rows={2}
            placeholder="Reply…"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
          />
          <button type="submit" className="btn-outline" disabled={sending || !reply.trim()}>
            {sending ? 'Sending…' : 'Reply'}
          </button>
        </form>
        {error && <p className="message message-error">{error}</p>}
      </div>
    </article>
  )
}
