/** A small "?" badge that shows a plain-English explanation on hover/focus, for a heading or label that needs a quick "what does this mean" note. */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="info-hint" title={text} aria-label={text} tabIndex={0}>
      ?
    </span>
  )
}
