import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Search,
  Inbox,
  MessageSquare,
  Bell,
  User,
  Settings,
  Lock,
  Award,
  PlayCircle,
  HelpCircle,
  X,
} from 'lucide-react'
import {
  MODULES,
  TOTAL_MINUTES,
  allComplete,
  firstIncompleteIndex,
  toCompletedMap,
  type DragDropExercise,
  type HotspotArea,
} from '../lib/trainingContent'
import './TrainingPortal.css'

// ---------------------------------------------------------------------------
// MOCK APP FRAME — a stand-in for the real product's screen.
// Swap the JSX inside for actual screenshots or a live iframe once available.
// ---------------------------------------------------------------------------
function Hotspot({ area, id, activeHotspot }: { area: HotspotArea; id: string; activeHotspot: string | null }) {
  const isActive = activeHotspot === id
  return (
    <button
      type="button"
      className="tp-hotspot"
      style={{
        top: area.top,
        left: area.left,
        width: area.w,
        height: area.h,
        border: isActive ? '2px solid #F2A93B' : '2px solid transparent',
        boxShadow: isActive ? '0 0 0 4px rgba(242,169,59,0.18), 0 0 24px rgba(242,169,59,0.35)' : 'none',
        background: isActive ? 'rgba(242,169,59,0.08)' : 'transparent',
      }}
      aria-label={`Highlight: ${id}`}
    />
  )
}

function MockApp({ activeHotspot }: { activeHotspot: string | null }) {
  return (
    <div className="tp-mock-frame">
      <div className="tp-topbar">
        <div className="tp-topbar-left">
          <span className="tp-status-dot" />
          HELPDESK · agent view
        </div>
        <div className="tp-topbar-right">
          <Bell size={12} />
          <Settings size={12} />
          <User size={12} />
        </div>
      </div>

      <div className="tp-left-rail">
        <div className="tp-left-rail-inner">
          <div className="tp-rail-item-active">
            <Inbox size={11} /> Inbox
          </div>
          <div className="tp-rail-item">
            <Search size={11} /> Search
          </div>
          <div className="tp-rail-item">
            <MessageSquare size={11} /> Snippets
          </div>
          <div className="tp-rail-filters-label">Filters</div>
          <div className="tp-rail-filter-active">Open</div>
          <div className="tp-rail-filter">Billing</div>
          <div className="tp-rail-filter">Priority</div>
        </div>
      </div>

      <div className="tp-main-col">
        <div className="tp-ticket-title">Ticket #4471 — "Charged twice this month"</div>
        <div className="tp-message-bubble">Hi — I noticed two charges on my card for the same plan. Can you help?</div>
        <div className="tp-internal-note">Internal note: check billing system for duplicate subscription IDs before replying.</div>
        <div className="tp-reply-box">
          <span className="tp-reply-placeholder">Type a reply… ( / for snippets )</span>
          <span className="tp-tag-snippets">Snippets</span>
        </div>
        <div className="tp-bottom-row">
          <span className="tp-tag-resolved">Resolved ▾</span>
          <div className="tp-gap-row">
            <span className="tp-tag-escalate">Escalate</span>
            <span className="tp-tag-close">Close</span>
          </div>
        </div>
      </div>

      {/* hotspots keyed by label text used in step data */}
      <Hotspot area={{ top: '8%', left: '4%', w: '20%', h: '10%' }} id="The dashboard" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '22%', left: '26%', w: '68%', h: '16%' }} id="Your queue" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '8%', left: '88%', w: '9%', h: '8%' }} id="Status toggle" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '8%', left: '26%', w: '40%', h: '8%' }} id="Search bar" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '22%', left: '4%', w: '20%', h: '40%' }} id="Filters" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '62%', left: '26%', w: '68%', h: '14%' }} id="Reply box" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '62%', left: '82%', w: '12%', h: '6%' }} id="Snippets" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '48%', left: '26%', w: '68%', h: '10%' }} id="Internal note" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '8%', left: '82%', w: '13%', h: '8%' }} id="Escalate button" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '34%', left: '26%', w: '68%', h: '12%' }} id="Escalation reason" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '78%', left: '26%', w: '30%', h: '8%' }} id="Resolution tag" activeHotspot={activeHotspot} />
      <Hotspot area={{ top: '78%', left: '82%', w: '12%', h: '8%' }} id="Close button" activeHotspot={activeHotspot} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confetti — a small no-dependency celebration burst shown on track completion.
// Respects prefers-reduced-motion via the app-wide rule in index.css, which
// clamps all animation-duration to ~0 for users who've asked for less motion.
// ---------------------------------------------------------------------------

// Deterministic 0-1 "randomness" from a seed, so generating the burst stays a
// pure function of the piece index - no Math.random() during render, and no
// effect needed just to smuggle non-determinism in after the fact.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: pseudoRandom(i * 3 + 1) * 100,
        delay: pseudoRandom(i * 7 + 2) * 0.5,
        duration: 2.2 + pseudoRandom(i * 11 + 3) * 1.6,
        color: ['#F2A93B', '#4FD1C5', '#E4826A', '#7C8AB8'][i % 4],
        rotate: pseudoRandom(i * 13 + 5) * 360,
      })),
    [],
  )

  return (
    <div className="tp-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="tp-confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Snippet drag-and-drop — practice picking the right canned response and
// dragging it into a mock reply box, mirroring the real workflow. Supports
// native HTML5 drag-and-drop and a click-to-select/click-to-place fallback
// so it works on touch devices and via keyboard. Keyed by the parent on
// mod.id + stepIdx so its local state resets cleanly between steps.
// ---------------------------------------------------------------------------
function SnippetDragExercise({
  exercise,
  solved,
  onSolve,
}: {
  exercise: DragDropExercise
  solved: boolean
  onSolve: () => void
}) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function place(id: string) {
    setFeedback(id === exercise.correctOptionId ? 'correct' : 'incorrect')
    if (id === exercise.correctOptionId) onSolve()
    setPickedId(null)
  }

  if (solved) {
    const placed = exercise.options.find((o) => o.id === exercise.correctOptionId)
    return (
      <div className="tp-drag-exercise tp-drag-solved">
        <div className="tp-drag-prompt">{exercise.prompt}</div>
        <div className="tp-drag-target tp-drag-target-filled">{placed?.label}</div>
        <div className="tp-result-right">
          <CheckCircle2 size={14} /> {exercise.successText}
        </div>
      </div>
    )
  }

  return (
    <div className="tp-drag-exercise">
      <div className="tp-drag-prompt">{exercise.prompt}</div>
      <div className="tp-drag-chips">
        {exercise.options.map((option) => (
          <button
            key={option.id}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', option.id)
              setPickedId(option.id)
            }}
            onDragEnd={() => setPickedId(null)}
            onClick={() => setPickedId((current) => (current === option.id ? null : option.id))}
            className="tp-drag-chip"
            aria-pressed={pickedId === option.id}
            style={{
              border: pickedId === option.id ? '1px solid #F2A93B' : '1px solid #2E3A5C',
              background: pickedId === option.id ? '#232E52' : '#171F38',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="tp-drag-target"
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const id = event.dataTransfer.getData('text/plain')
          if (id) place(id)
        }}
        onClick={() => {
          if (pickedId) place(pickedId)
        }}
        style={{
          border: dragOver ? '2px dashed #F2A93B' : '2px dashed #2E3A5C',
          background: dragOver ? 'rgba(242,169,59,0.08)' : '#141B32',
        }}
      >
        {pickedId
          ? `Drop here to place it in the ${exercise.targetLabel.toLowerCase()}`
          : `Drag or select a snippet, then place it in the ${exercise.targetLabel.toLowerCase()}`}
      </button>
      {feedback === 'incorrect' && <div className="tp-result-wrong">{exercise.incorrectText}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Help widget — generic, content-agnostic FAQ. Safe to ship even with
// placeholder training content since none of the answers reference specifics.
// ---------------------------------------------------------------------------
function HelpWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="tp-help">
      {open && (
        <div className="tp-help-panel" role="dialog" aria-label="Training portal help">
          <div className="tp-help-panel-head">
            <strong>Need help?</strong>
            <button type="button" className="tp-help-close" onClick={() => setOpen(false)} aria-label="Close help">
              <X size={14} />
            </button>
          </div>
          <dl className="tp-help-list">
            <dt>How is my progress saved?</dt>
            <dd>Automatically, the moment you pass a module's check — no need to click save.</dd>
            <dt>What happens if I get a question wrong?</dt>
            <dd>Review the highlighted screen and try again. There's no limit on attempts.</dd>
            <dt>Can I revisit a finished module?</dt>
            <dd>Yes — click any completed module in the sidebar to go back through it.</dd>
            <dt>Who do I contact with questions?</dt>
            <dd>Reach out to your manager.</dd>
          </dl>
        </div>
      )}
      <button type="button" className="tp-help-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <HelpCircle size={16} /> Help
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN PORTAL
// ---------------------------------------------------------------------------
type Phase = 'walkthrough' | 'quiz' | 'done'

export function TrainingPortal({
  learnerName,
  completedModuleIds,
  onModuleComplete,
  onResetProgress,
  notesStorageKey,
}: {
  learnerName: string
  completedModuleIds: string[]
  onModuleComplete: (moduleId: string) => void
  onResetProgress: () => void
  notesStorageKey: string
}) {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => toCompletedMap(completedModuleIds))
  const [moduleIdx, setModuleIdx] = useState(() => firstIncompleteIndex(toCompletedMap(completedModuleIds)))
  const [phase, setPhase] = useState<Phase>(() => (allComplete(toCompletedMap(completedModuleIds)) ? 'done' : 'walkthrough'))
  const [stepIdx, setStepIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizResult, setQuizResult] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [dragSolved, setDragSolved] = useState<Record<string, boolean>>({})

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(notesStorageKey)
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  const panelRef = useRef<HTMLDivElement>(null)

  // Falls back to the first module/step rather than crashing if moduleIdx or
  // stepIdx ever end up out of range (e.g. stale progress referencing a
  // module that no longer exists in the current content model).
  const mod = MODULES[moduleIdx] ?? MODULES[0]
  const step = mod.steps[stepIdx] ?? mod.steps[0]
  const totalDone = Object.keys(completed).length
  const progressPct = Math.round((totalDone / MODULES.length) * 100)
  const remainingMinutes = MODULES.filter((m) => !completed[m.id]).reduce((sum, m) => sum + m.estimatedMinutes, 0)

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return MODULES
    return MODULES.filter((m) => `${m.title} ${m.blurb}`.toLowerCase().includes(q))
  }, [search])

  const announcement =
    phase === 'walkthrough'
      ? `Step ${stepIdx + 1} of ${mod.steps.length}: ${step.label}`
      : phase === 'quiz'
        ? `Quick check for ${mod.title}`
        : 'Track complete'

  // Move focus into the panel whenever its content changes underneath it, so
  // keyboard/screen-reader users land on the new step or quiz without having
  // to re-navigate from the top of the page.
  useEffect(() => {
    panelRef.current?.focus()
  }, [phase, stepIdx, moduleIdx])

  useEffect(() => {
    if (phase !== 'walkthrough') return

    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return
      if (event.key === 'ArrowRight') goStep(1)
      if (event.key === 'ArrowLeft') goStep(-1)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, moduleIdx])

  function goStep(dir: number) {
    if (dir > 0 && dragBlocked) return
    const next = stepIdx + dir
    if (next < 0) return
    if (next >= mod.steps.length) {
      setPhase('quiz')
      setQuizAnswers({})
      setQuizResult(null)
      return
    }
    setStepIdx(next)
  }

  function selectAnswer(qi: number, oi: number) {
    setQuizAnswers((p) => ({ ...p, [qi]: oi }))
  }

  function submitQuiz() {
    const correct = mod.quiz.every((q, i) => quizAnswers[i] === q.answer)
    setQuizResult(correct)
    if (correct) {
      setCompleted((p) => ({ ...p, [mod.id]: true }))
      onModuleComplete(mod.id)
    }
  }

  function goToModule(i: number) {
    if (i > 0 && !completed[MODULES[i - 1].id]) return // locked
    setModuleIdx(i)
    setStepIdx(0)
    setPhase('walkthrough')
    setQuizResult(null)
  }

  function nextModule() {
    if (moduleIdx < MODULES.length - 1) {
      goToModule(moduleIdx + 1)
    } else {
      setPhase('done')
    }
  }

  function updateNote(key: string, value: string) {
    setNotes((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(notesStorageKey, JSON.stringify(next))
      } catch {
        // localStorage can throw in private browsing / at quota - notes just won't persist.
      }
      return next
    })
  }

  function handleReset() {
    const confirmed = window.confirm('Reset all your training progress? Completed modules will be locked again.')
    if (!confirmed) return
    onResetProgress()
    setCompleted({})
    setModuleIdx(0)
    setStepIdx(0)
    setPhase('walkthrough')
    setQuizAnswers({})
    setQuizResult(null)
    setDragSolved({})
  }

  const noteKey = `${mod.id}:${stepIdx}`
  const dragBlocked = Boolean(step.dragDrop) && !dragSolved[noteKey]
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="tp-root">
      <div aria-live="polite" className="tp-sr-only">
        {announcement}
      </div>

      <div className="tp-sidebar">
        <div className="tp-logo-row">
          <div className="tp-logo-mark">
            <PlayCircle size={16} color="#0E1426" />
          </div>
          <div className="tp-brand-text">Training Academy</div>
        </div>
        <div className="tp-sidebar-subtitle">Learner onboarding track</div>

        <div className="tp-progress-wrap">
          <div className="tp-progress-label">
            <span>PROGRESS</span>
            <span>{progressPct}%</span>
          </div>
          <div className="tp-progress-track">
            <div className="tp-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="tp-time-remaining">
            {remainingMinutes > 0 ? `~${remainingMinutes} of ${TOTAL_MINUTES} min left` : 'All modules complete'}
          </div>
        </div>

        <div className="tp-search">
          <Search size={12} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search modules…"
            aria-label="Search training modules"
          />
        </div>

        <div className="tp-module-list">
          {filteredModules.map((m) => {
            const i = MODULES.findIndex((mm) => mm.id === m.id)
            const isActive = i === moduleIdx && phase !== 'done'
            const isDone = completed[m.id]
            const isLocked = i > 0 && !completed[MODULES[i - 1].id]
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => goToModule(i)}
                disabled={isLocked}
                className="tp-module-btn"
                style={{
                  background: isActive ? '#1B2540' : 'transparent',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.45 : 1,
                }}
              >
                <span className="tp-module-icon">
                  {isDone ? (
                    <CheckCircle2 size={15} color="#4FD1C5" />
                  ) : isLocked ? (
                    <Lock size={13} color="#4A5680" />
                  ) : (
                    <Circle size={15} color="#7C8AB8" />
                  )}
                </span>
                <span>
                  <div className="tp-module-title" style={{ color: isActive ? '#E8ECF6' : '#B7C0E0' }}>
                    {m.title}
                  </div>
                  <div className="tp-module-blurb">
                    {m.blurb} · ~{m.estimatedMinutes} min
                  </div>
                </span>
              </button>
            )
          })}
          {filteredModules.length === 0 && <div className="tp-search-empty">No modules match "{search}".</div>}
        </div>

        <button type="button" className="tp-reset-link" onClick={handleReset}>
          Reset my progress
        </button>
      </div>

      <div className="tp-main">
        <div className="tp-main-inner">
          {phase === 'done' ? (
            <div className="tp-done">
              <Confetti />
              <Award size={40} color="#F2A93B" />
              <div className="tp-done-title">Track complete</div>
              <div className="tp-done-sub">You've finished every module. You're ready to take live tickets.</div>

              <div className="tp-certificate">
                <div className="tp-certificate-eyebrow">CERTIFICATE OF COMPLETION</div>
                <div className="tp-certificate-name">{learnerName}</div>
                <div className="tp-certificate-body">has successfully completed the</div>
                <div className="tp-certificate-track">Training Academy onboarding track</div>
                <div className="tp-certificate-date">{today}</div>
              </div>

              <div className="tp-done-actions">
                <button type="button" className="tp-btn-primary" onClick={() => window.print()}>
                  Print certificate
                </button>
                <button type="button" className="tp-btn-review" onClick={handleReset}>
                  Reset progress
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="tp-eyebrow">
                MODULE {moduleIdx + 1} / {MODULES.length}
              </div>
              <div className="tp-module-heading">{mod.title}</div>
              <div className="tp-module-heading-blurb">{mod.blurb}</div>

              <MockApp activeHotspot={phase === 'walkthrough' ? step.label : null} />

              {phase === 'walkthrough' && (
                <div className="tp-panel" ref={panelRef} tabIndex={-1}>
                  <div className="tp-step-eyebrow">
                    STEP {stepIdx + 1} / {mod.steps.length} — {step.label}
                  </div>
                  <div className="tp-step-text">{step.text}</div>

                  {step.dragDrop && (
                    <SnippetDragExercise
                      key={noteKey}
                      exercise={step.dragDrop}
                      solved={dragSolved[noteKey] ?? false}
                      onSolve={() => setDragSolved((prev) => ({ ...prev, [noteKey]: true }))}
                    />
                  )}

                  <label className="tp-notes-label">
                    Your notes (private, saved on this device)
                    <textarea
                      className="tp-notes-input"
                      rows={2}
                      value={notes[noteKey] ?? ''}
                      onChange={(event) => updateNote(noteKey, event.target.value)}
                      placeholder="Jot down anything you want to remember about this step…"
                    />
                  </label>

                  <div className="tp-nav-row">
                    <button
                      type="button"
                      onClick={() => goStep(-1)}
                      disabled={stepIdx === 0}
                      className="tp-btn-back"
                      style={{ color: stepIdx === 0 ? '#334066' : '#B7C0E0', cursor: stepIdx === 0 ? 'default' : 'pointer' }}
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      onClick={() => goStep(1)}
                      disabled={dragBlocked}
                      className="tp-btn-primary"
                      style={{ opacity: dragBlocked ? 0.5 : 1, cursor: dragBlocked ? 'default' : 'pointer' }}
                    >
                      {stepIdx === mod.steps.length - 1 ? 'Take the check' : 'Next'} <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {phase === 'quiz' && (
                <div className="tp-panel" ref={panelRef} tabIndex={-1}>
                  <div className="tp-quiz-eyebrow">QUICK CHECK</div>
                  {mod.quiz.map((q, qi) => (
                    <div key={qi} className="tp-question">
                      <div className="tp-question-text">{q.q}</div>
                      <div className="tp-options">
                        {q.options.map((opt, oi) => {
                          const selected = quizAnswers[qi] === oi
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => selectAnswer(qi, oi)}
                              className="tp-option-btn"
                              style={{
                                background: selected ? '#232E52' : '#171F38',
                                border: selected ? '1px solid #F2A93B' : '1px solid #2E3A5C',
                              }}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {quizResult === false && (
                    <div className="tp-result-wrong">Not quite — review the highlighted screen above and try again.</div>
                  )}
                  {quizResult === true && (
                    <div className="tp-result-right">
                      <CheckCircle2 size={14} /> Nice — module complete.
                    </div>
                  )}

                  <div className="tp-quiz-nav-row">
                    <button type="button" onClick={() => setPhase('walkthrough')} className="tp-btn-review">
                      ← Review steps
                    </button>
                    {quizResult ? (
                      <button type="button" onClick={nextModule} className="tp-btn-success">
                        {moduleIdx === MODULES.length - 1 ? 'Finish track' : 'Next module'} <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={submitQuiz}
                        disabled={Object.keys(quizAnswers).length < mod.quiz.length}
                        className="tp-btn-submit"
                        style={{
                          background: Object.keys(quizAnswers).length < mod.quiz.length ? '#334066' : '#F2A93B',
                          cursor: Object.keys(quizAnswers).length < mod.quiz.length ? 'default' : 'pointer',
                        }}
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <HelpWidget />
    </div>
  )
}
