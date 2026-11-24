// One answer in the conversation (MB-06 AC2-AC4, AC6-AC7, AC9-AC11): its search
// step, then its parts as they stream in (statements, paragraphs, tables, a
// follow-up), then where it came from. Parses the program text with
// library.ts each time more arrives; part-written statements show as they are.
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { checkOf, citationNumbers, citationState, citedDocuments, citeKey, spokenText, type Check } from '../answer'
import { answerParser, type ElementNode } from '../library'
import type { Turn } from '../useConversation'
import { withBold } from '../bold'
import { CitationMarker, type OpenCitation } from './CitationMarker'
import { DotMatrixLoader } from './DotMatrixLoader'
import { PlayButton } from './PlayButton'
import { SearchLine } from './SearchLine'

type Props = {
  turn: Extract<Turn, { role: 'assistant' }>
  names: Map<string, string>
  onAsk(question: string): void
  onOpenCitation(c: OpenCitation): void
  onRetry(): void
  // Only the last answer can be asked again.
  canRetry: boolean
}

const isElement = (x: unknown): x is ElementNode =>
  Boolean(x) && typeof x === 'object' && (x as ElementNode).type === 'element'
const list = (x: unknown) => (Array.isArray(x) ? x.filter(isElement) : [])

export function AnswerView({ turn, names, onAsk, onOpenCitation, onRetry, canRetry }: Props) {
  // One parser per answer, kept across renders; fed the whole text so far.
  const [parser] = useState(answerParser)
  const root = useMemo(() => (turn.received.program ? parser.set(turn.received.program).root : null), [parser, turn.received.program])
  const check = checkOf(root)
  const numbers = citationNumbers(root)
  const sources = citedDocuments(root, check)

  // The markers after a statement or cell.
  const cites = (node: ElementNode) =>
    list(node.props.cites).map((c, i) => {
      const { passage, quote } = c.props as { passage: string; quote: string }
      const number = numbers.get(citeKey(passage, quote))
      if (!number) return null
      const source = check?.sources.get(passage)
      return (
        <CitationMarker
          key={i}
          number={number}
          label={passage}
          quote={quote}
          state={citationState(check, passage, quote, turn.status !== 'streaming')}
          source={source}
          documentName={source && names.get(source.documentId)}
          onOpen={onOpenCitation}
        />
      )
    })

  // One statement's words and markers, as inline text.
  const statement = (node: ElementNode, key: number) => (
    <Text key={key}>
      {withBold(String(node.props.text ?? ''))}
      {cites(node)}{' '}
    </Text>
  )

  function block(node: ElementNode, key: number) {
    switch (node.typeName) {
      case 'Statement':
        return (
          <Text key={key} className="text-base leading-6">
            {statement(node, 0)}
          </Text>
        )
      case 'Paragraph':
        return (
          <Text key={key} className="text-base leading-6">
            {list(node.props.statements).map(statement)}
          </Text>
        )
      case 'CitedTable':
        return <AnswerTable key={key} node={node} renderCell={(cell) => <Text className="text-sm">{statement(cell, 0)}</Text>} />
      case 'FollowUp': {
        const question = String(node.props.question ?? '')
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Ask: ${question}`}
            disabled={node.partial}
            onPress={() => onAsk(question)}
            className="min-h-12 justify-center rounded-lg border border-primary px-4 py-2 active:bg-secondary"
          >
            <Text className="font-medium text-primary">{withBold(question)}</Text>
          </Pressable>
        )
      }
      default:
        return null
    }
  }

  return (
    <Card className="gap-3 px-4 py-4">
      {/* As on the web: the dot loader from asking until the search step begins
          (planning comes first), then the search line. */}
      {turn.received.search ? (
        <SearchLine search={turn.received.search} />
      ) : (
        turn.status === 'streaming' && !root && <DotMatrixLoader />
      )}
      {list(root?.props.blocks).map(block)}
      {/* Read aloud (MB-25), once the answer is whole. */}
      {turn.status === 'done' && <PlayButton id={String(turn.id)} text={spokenText(root)} />}
      <Footer turn={turn} check={check} sources={sources} onRetry={canRetry ? onRetry : undefined} />
    </Card>
  )
}

// Where the answer came from, or how it ended.
function Footer({ turn, check, sources, onRetry }: { turn: Props['turn']; check: Check; sources: number; onRetry?(): void }) {
  if (turn.status === 'error') {
    return (
      <View className="gap-2">
        <Text className="text-destructive">{turn.error}</Text>
        {onRetry && (
          <Button variant="outline" accessibilityLabel="Try again" onPress={onRetry}>
            <Text>Try again</Text>
          </Button>
        )}
      </View>
    )
  }
  if (turn.status === 'stopped') return <Text className="text-sm text-muted-foreground">Stopped</Text>
  if (check && sources > 0) {
    // The design system's provenance line, in violet: what the machine drew on.
    return <Text className="text-sm font-medium" style={{ color: '#6258a3' }}>{sources === 1 ? 'From 1 source' : `From ${sources} sources`}</Text>
  }
  return null
}

// A comparison table, scrolling sideways on a phone (AC11).
function AnswerTable({ node, renderCell }: { node: ElementNode; renderCell(cell: ElementNode): React.ReactNode }) {
  const headers = Array.isArray(node.props.headers) ? (node.props.headers as string[]) : []
  // A row still streaming may not be a list yet; it's skipped rather than crashing the screen.
  const rows = Array.isArray(node.props.rows) ? (node.props.rows as unknown[]).filter(Array.isArray) : []
  return (
    <ScrollView testID="answer-table" horizontal showsHorizontalScrollIndicator>
      <View className="overflow-hidden rounded-md border border-border">
        <View className="flex-row bg-muted">
          {headers.map((h, i) => (
            <Text key={i} className="w-36 px-3 py-2 text-sm font-semibold">
              {h}
            </Text>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} className="flex-row border-t border-border">
            {row.map((cell, c) => (
              <View key={c} className="w-36 px-3 py-2">
                {isElement(cell) ? renderCell(cell) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
