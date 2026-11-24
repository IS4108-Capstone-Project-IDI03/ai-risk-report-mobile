// Reading a parsed answer (MB-06 AC3-AC5): citation numbers, and the server's
// quote check from the Meta line. Copied in behaviour from the web's
// client/src/features/chat/library.tsx (citationNumbers) and citationCheck.ts.
import type { ElementNode } from './library'

export type Source = {
  label: string
  documentId: string
  passageId?: string
  pageStart?: number
  pageEnd?: number
  withdrawn?: boolean
}

// The Meta line: where each passage label points, which quotes weren't found,
// and whether the knowledge base lacked an answer. null until it arrives.
export type Check = { sources: Map<string, Source>; unverified: Set<string>; gap: boolean } | null

// One citation: a passage label and its quoted words together. The same words
// can be right in P1 and wrong in P3, so it's never the label alone.
export const citeKey = (label: string, quote: string) => `${label}\u0000${quote}`

const isElement = (x: unknown): x is ElementNode =>
  Boolean(x) && typeof x === 'object' && (x as ElementNode).type === 'element'

// Each citation's number, in the order the answer first cites it (1, 2, 3…).
// The same quote cited again keeps its number (AC3).
export function citationNumbers(node: unknown, numbers = new Map<string, number>()) {
  if (Array.isArray(node)) node.forEach((child) => citationNumbers(child, numbers))
  else if (isElement(node)) {
    const { passage, quote } = node.props as { passage?: unknown; quote?: unknown }
    if (node.typeName === 'Cite' && typeof passage === 'string' && typeof quote === 'string') {
      const key = citeKey(passage, quote)
      if (!numbers.has(key)) numbers.set(key, numbers.size + 1)
    }
    Object.values(node.props).forEach((value) => citationNumbers(value, numbers))
  }
  return numbers
}

export function checkOf(root: ElementNode | null): Check {
  const meta = root?.props.meta
  if (!isElement(meta)) return null
  const { sources = [], unverified = [], gap } = meta.props as {
    sources?: Source[]
    unverified?: { label: string; quote: string }[]
    gap?: boolean
  }
  return {
    sources: new Map(sources.map((s) => [s.label, s])),
    unverified: new Set(unverified.map((u) => citeKey(u.label, u.quote))),
    gap: Boolean(gap),
  }
}

export type CitationState = 'checking' | 'verified' | 'unverified'

// A citation's state: checking until the Meta line arrives. An answer that
// ended without one (stopped, or cut off) was never checked: unverified. An
// invented label has no source, so it can't be verified either.
export function citationState(check: Check, label: string, quote: string, settled = false): CitationState {
  if (!check) return settled ? 'unverified' : 'checking'
  return check.sources.has(label) && !check.unverified.has(citeKey(label, quote)) ? 'verified' : 'unverified'
}

// How many documents the answer's citations come from (AC4).
export function citedDocuments(root: ElementNode | null, check: Check) {
  if (!check) return 0
  const docs = new Set<string>()
  for (const key of citationNumbers(root).keys()) {
    const source = check.sources.get(key.split('\u0000')[0])
    if (source?.documentId) docs.add(source.documentId)
  }
  return docs.size
}

// "Page 81", "Pages 82–83", or null when the passage has no page (e.g. 0).
export function pagesText(start?: number, end?: number) {
  if (!start) return null
  return end && end !== start ? `Pages ${start}–${end}` : `Page ${start}`
}

// An answer as plain words to read aloud (MB-25): its statements, in order, with no citation numbers (they
// are drawn beside the text, not in it) and no bold marks. Tables and follow-up questions are left out.
const plain = (x: unknown) => String(x ?? '').replace(/\*\*/g, '').trim()
const elements = (x: unknown) => (Array.isArray(x) ? x.filter(isElement) : [])
export function spokenText(root: ElementNode | null) {
  return elements(root?.props.blocks)
    .map((b) => (b.typeName === 'Statement' ? plain(b.props.text) : b.typeName === 'Paragraph' ? elements(b.props.statements).map((s) => plain(s.props.text)).join(' ') : ''))
    .filter(Boolean)
    .join(' ')
}
