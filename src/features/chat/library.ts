// The parts a chat answer is written in (MB-06), and the parser that reads it.
// An answer is OpenUI Lang: one `name = Component(...)` per line, written by the
// RAG service's model. Names and props must match the web's
// client/src/features/chat/library.tsx and the service's
// microservices/rag-service/app/chat/answer_components.txt.
// Parsing uses OpenUI's framework-free core, as the web does under its React layer.
import { createLibrary, createStreamingParser, defineComponent, type ElementNode } from '@openuidev/lang-core'
import { z } from 'zod'

// The app draws each part itself (components/AnswerView.tsx), so none carries a component.
const part = <T extends z.ZodObject>(name: string, description: string, props: T) =>
  defineComponent({ name, description, props, component: null })

const Cite = part('Cite', 'A passage label and its exact words.', z.object({ passage: z.string(), quote: z.string() }))
// `cites` optional so a half-written statement still shows while it streams (as on the web).
const Statement = part('Statement', 'One statement and its citations.', z.object({ text: z.string(), cites: z.array(Cite.ref).optional() }))
const Paragraph = part('Paragraph', 'Statements that read as one paragraph.', z.object({ statements: z.array(Statement.ref) }))
const Cell = part('Cell', 'A table cell and its citations.', z.object({ text: z.string(), cites: z.array(Cite.ref).optional() }))
const CitedTable = part(
  'CitedTable',
  'A comparison table.',
  z.object({ headers: z.array(z.string()), rows: z.array(z.array(Cell.ref)) }),
)
const FollowUp = part('FollowUp', 'One follow-up question.', z.object({ question: z.string() }))
// Written by the server, never the model: the quote check (rag-service answer.py).
const Meta = part(
  'Meta',
  'Server only.',
  z.object({
    sources: z.array(
      z.object({
        label: z.string(),
        documentId: z.string(),
        passageId: z.string().optional(),
        pageStart: z.number().optional(),
        pageEnd: z.number().optional(),
        withdrawn: z.boolean().optional(),
      }),
    ),
    unverified: z.array(z.object({ label: z.string(), quote: z.string() })),
    gap: z.boolean().optional(),
  }),
)
const Answer = part(
  'Answer',
  'The whole answer.',
  z.object({
    blocks: z.array(z.union([Paragraph.ref, Statement.ref, CitedTable.ref, FollowUp.ref])),
    meta: z.optional(Meta.ref),
  }),
)

const library = createLibrary({
  components: [Answer, Paragraph, Statement, CitedTable, Cell, Cite, FollowUp, Meta],
  root: 'Answer',
})

// A parser for one answer. Fed the whole text so far each time, it returns the
// answer's tree, with part-written statements marked `partial`.
export const answerParser = () => createStreamingParser(library.toJSONSchema(), 'Answer')

export type { ElementNode }
