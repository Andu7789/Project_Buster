import { useState } from 'react'
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
} from 'lucide-react'
import './TrainingPortal.css'

// ---------------------------------------------------------------------------
// CONTENT MODEL
// This is placeholder demo content standing in for the real training
// material. Each module has a short guided walkthrough (hotspots over a mock
// app frame) followed by a 2-question check. Swap MODULES and the MockApp
// screens for the real product's screens/copy once they're ready.
// ---------------------------------------------------------------------------

interface HotspotArea {
  top: string
  left: string
  w: string
  h: string
}

interface Step {
  label: string
  hotspot: HotspotArea
  text: string
}

interface QuizQuestion {
  q: string
  options: string[]
  answer: number
}

interface Module {
  id: string
  title: string
  blurb: string
  steps: Step[]
  quiz: QuizQuestion[]
}

const MODULES: Module[] = [
  {
    id: 'start',
    title: 'Getting started',
    blurb: 'Log in and get oriented on the dashboard.',
    steps: [
      {
        label: 'The dashboard',
        hotspot: { top: '8%', left: '4%', w: '20%', h: '10%' },
        text: 'When you log in, you land here. The left rail is your home base for the rest of the shift — inbox, search, and settings all live here.',
      },
      {
        label: 'Your queue',
        hotspot: { top: '22%', left: '26%', w: '68%', h: '16%' },
        text: 'This is your queue: every open conversation assigned to you, newest first. A filled dot means the customer is waiting on your reply.',
      },
      {
        label: 'Status toggle',
        hotspot: { top: '8%', left: '88%', w: '9%', h: '8%' },
        text: 'Set yourself Available or Away here. Away removes you from new-ticket routing but keeps your existing queue visible.',
      },
    ],
    quiz: [
      {
        q: 'A filled dot next to a ticket means:',
        options: ['The customer is waiting on a reply', 'The ticket is closed', "It's a VIP customer"],
        answer: 0,
      },
      {
        q: "Setting yourself to 'Away' does what?",
        options: ['Logs you out', 'Stops new tickets routing to you, keeps your current queue', 'Deletes your queue'],
        answer: 1,
      },
    ],
  },
  {
    id: 'find',
    title: 'Finding a ticket',
    blurb: 'Search and filter to pull up the right conversation fast.',
    steps: [
      {
        label: 'Search bar',
        hotspot: { top: '8%', left: '26%', w: '40%', h: '8%' },
        text: 'Search by customer name, email, or ticket number. It also matches text inside messages, so a distinctive phrase works too.',
      },
      {
        label: 'Filters',
        hotspot: { top: '22%', left: '4%', w: '20%', h: '40%' },
        text: "Narrow by status, priority, or tag. Combine filters — e.g. 'Open' + 'Billing' — to build a focused worklist.",
      },
    ],
    quiz: [
      {
        q: 'Search matches on:',
        options: ['Name and email only', 'Name, email, ticket number, and message text', 'Ticket number only'],
        answer: 1,
      },
    ],
  },
  {
    id: 'respond',
    title: 'Responding to a customer',
    blurb: 'Reply, use canned responses, and attach files.',
    steps: [
      {
        label: 'Reply box',
        hotspot: { top: '62%', left: '26%', w: '68%', h: '14%' },
        text: 'Type your reply here. It saves as a draft automatically if you navigate away mid-sentence.',
      },
      {
        label: 'Snippets',
        hotspot: { top: '62%', left: '82%', w: '12%', h: '6%' },
        text: "Snippets insert pre-written answers for common questions. Type '/' in the reply box to search them without leaving the keyboard.",
      },
      {
        label: 'Internal note',
        hotspot: { top: '48%', left: '26%', w: '68%', h: '10%' },
        text: 'Internal notes are only visible to your team — use them to flag context for whoever picks up the ticket next. Customers never see these.',
      },
    ],
    quiz: [
      {
        q: "Typing '/' in the reply box:",
        options: ['Sends the message', 'Opens snippet search', 'Deletes the draft'],
        answer: 1,
      },
      {
        q: 'Internal notes are visible to:',
        options: ['The customer and your team', 'Only your team', 'Only you'],
        answer: 1,
      },
    ],
  },
  {
    id: 'escalate',
    title: 'Escalating an issue',
    blurb: 'Know when and how to hand off a ticket.',
    steps: [
      {
        label: 'Escalate button',
        hotspot: { top: '8%', left: '82%', w: '13%', h: '8%' },
        text: 'Escalate when an issue needs a specialist or manager — refunds over policy limits, legal threats, or repeated unresolved contact.',
      },
      {
        label: 'Escalation reason',
        hotspot: { top: '34%', left: '26%', w: '68%', h: '12%' },
        text: 'Always add a one-line reason. It routes the ticket faster and saves the next person from re-reading the whole thread.',
      },
    ],
    quiz: [
      {
        q: 'Which is a good reason to escalate?',
        options: [
          'The customer used a rude tone once',
          "A refund request exceeds your policy limit",
          "You're not sure which snippet to use",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: 'close',
    title: 'Closing a ticket',
    blurb: 'Wrap up and tag the outcome.',
    steps: [
      {
        label: 'Resolution tag',
        hotspot: { top: '78%', left: '26%', w: '30%', h: '8%' },
        text: 'Tag the outcome (Resolved, No response needed, Duplicate) before closing — this is what your team\'s weekly reporting runs on.',
      },
      {
        label: 'Close button',
        hotspot: { top: '78%', left: '82%', w: '12%', h: '8%' },
        text: 'Closing removes the ticket from your active queue. It can always be reopened if the customer replies again.',
      },
    ],
    quiz: [
      {
        q: 'Why tag a resolution before closing?',
        options: ["It's required by the reply box", 'It feeds team reporting', 'It notifies the customer'],
        answer: 1,
      },
    ],
  },
]

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
// MAIN PORTAL
// ---------------------------------------------------------------------------
type Phase = 'walkthrough' | 'quiz' | 'done'

export function TrainingPortal() {
  const [moduleIdx, setModuleIdx] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('walkthrough')
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizResult, setQuizResult] = useState<boolean | null>(null)

  const mod = MODULES[moduleIdx]
  const step = mod.steps[stepIdx]
  const totalDone = Object.keys(completed).length
  const progressPct = Math.round((totalDone / MODULES.length) * 100)

  function goStep(dir: number) {
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

  return (
    <div className="tp-root">
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
        </div>

        <div className="tp-module-list">
          {MODULES.map((m, i) => {
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
                  <div className="tp-module-blurb">{m.blurb}</div>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="tp-main">
        <div className="tp-main-inner">
          {phase === 'done' ? (
            <div className="tp-done">
              <Award size={40} color="#F2A93B" />
              <div className="tp-done-title">Track complete</div>
              <div className="tp-done-sub">You've finished every module. You're ready to take live tickets.</div>
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
                <div className="tp-panel">
                  <div className="tp-step-eyebrow">
                    STEP {stepIdx + 1} / {mod.steps.length} — {step.label}
                  </div>
                  <div className="tp-step-text">{step.text}</div>
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
                    <button type="button" onClick={() => goStep(1)} className="tp-btn-primary">
                      {stepIdx === mod.steps.length - 1 ? 'Take the check' : 'Next'} <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {phase === 'quiz' && (
                <div className="tp-panel">
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
    </div>
  )
}
