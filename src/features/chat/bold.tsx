// Bold for the document names the model wraps in **…**, and section signs
// spelled out, as on the web (client/src/features/chat/components/bold.tsx).
// Used by components/AnswerView.tsx for statements, cells and follow-ups.
import { Text } from '@/components/ui/text'

// "§§ 8.15" reads "Sections 8.15" and "§ 8.15" "Section 8.15" (the web's rule:
// never show the sign). Quoted words in the citation sheet keep theirs, since
// they must match the source.
export const spellSections = (text: string) => text.replace(/§§\s*/g, 'Sections ').replace(/§\s*/g, 'Section ')

// The text as plain and bold parts, for nesting inside a <Text>.
export function withBold(text: string) {
  let spelled = spellSections(text)
  // A name still streaming has its opening ** only: close it, so it shows bold
  // as it's written instead of as raw asterisks that then jump to bold.
  if ((spelled.match(/\*\*/g) ?? []).length % 2) spelled += '**'
  return spelled.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <Text key={i} className="font-semibold">
        {part}
      </Text>
    ) : (
      part
    ),
  )
}
