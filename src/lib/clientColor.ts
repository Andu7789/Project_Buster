import type { CSSProperties } from 'react'

/** Curated accent swatches offered in the client color picker - pastel-friendly against the app's light theme. */
export const CLIENT_COLOR_PALETTE = [
  '#6673d1', // indigo
  '#e2823f', // orange
  '#3fa866', // green
  '#c9599f', // magenta
  '#d0aa2b', // yellow
  '#4c9bd9', // sky blue
  '#d9534f', // red
  '#5fb8a6', // teal
  '#9b7fd4', // purple
  '#c97b4f', // terracotta
]

export const DEFAULT_CLIENT_COLOR = CLIENT_COLOR_PALETTE[0]

function mixWithWhite(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  const mix = (channel: number) => Math.round(channel * amount + 255 * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/** CSS custom properties for a client's card/panel background+border+accent, derived from their stored accent color. */
export function clientColorVars(color: string): CSSProperties {
  return {
    '--client-bg': mixWithWhite(color, 0.12),
    '--client-border': mixWithWhite(color, 0.4),
    '--client-accent': color,
  } as CSSProperties
}

/** Picks a palette color that isn't already used by an existing client, cycling once every color is taken. */
export function nextClientColor(existingColors: string[]): string {
  const unused = CLIENT_COLOR_PALETTE.find((color) => !existingColors.includes(color))
  if (unused) return unused
  return CLIENT_COLOR_PALETTE[existingColors.length % CLIENT_COLOR_PALETTE.length]
}
