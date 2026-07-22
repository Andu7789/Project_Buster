// ---------------------------------------------------------------------------
// CONTENT MODEL
// This is placeholder demo content standing in for the real training
// material. Each module has a short guided walkthrough (hotspots over a mock
// app frame) followed by a 2-question check. Swap MODULES and the MockApp
// screens (in TrainingPortal.tsx) for the real product's screens/copy once
// they're ready - everything else (progress persistence, search, resume,
// certificate, etc.) is content-agnostic and doesn't need to change.
// ---------------------------------------------------------------------------

export interface HotspotArea {
  top: string
  left: string
  w: string
  h: string
}

export interface Step {
  label: string
  hotspot: HotspotArea
  text: string
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
}

export interface Module {
  id: string
  title: string
  blurb: string
  estimatedMinutes: number
  steps: Step[]
  quiz: QuizQuestion[]
}

export const MODULES: Module[] = [
  {
    id: 'start',
    title: 'Getting started',
    blurb: 'Log in and get oriented on the dashboard.',
    estimatedMinutes: 4,
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
    estimatedMinutes: 3,
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
    estimatedMinutes: 5,
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
    estimatedMinutes: 3,
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
          'A refund request exceeds your policy limit',
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
    estimatedMinutes: 2,
    steps: [
      {
        label: 'Resolution tag',
        hotspot: { top: '78%', left: '26%', w: '30%', h: '8%' },
        text: "Tag the outcome (Resolved, No response needed, Duplicate) before closing — this is what your team's weekly reporting runs on.",
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

export const TOTAL_MINUTES = MODULES.reduce((sum, m) => sum + m.estimatedMinutes, 0)

// Exposed so other parts of the app (the owner's reporting view) can talk
// about training progress without importing the whole TrainingPortal component.
export const TRAINING_MODULE_COUNT = MODULES.length
export const TRAINING_MODULE_TITLES: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.id, m.title]))

export function toCompletedMap(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true]))
}

export function firstIncompleteIndex(completed: Record<string, boolean>): number {
  const idx = MODULES.findIndex((m) => !completed[m.id])
  return idx === -1 ? MODULES.length - 1 : idx
}

export function allComplete(completed: Record<string, boolean>): boolean {
  return MODULES.every((m) => completed[m.id])
}
