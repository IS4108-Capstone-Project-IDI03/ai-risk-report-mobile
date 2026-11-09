// Where one checklist item came from (MB-05 AC7): each standard it cites with its page
// and the quoted words, marked Unverified if the quote isn't in the passage; or that it
// comes from the report template; or that no standard covers it. Used by ItemRow.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Checklist, Item, Source, Standard } from '../api'

const pages = (s?: Source) =>
  s?.page_start == null ? null : s.page_end && s.page_end !== s.page_start ? `Pages ${s.page_start}–${s.page_end}` : `Page ${s.page_start}`

const standardName = (standards: Standard[], source?: Source) => {
  const s = standards.find((x) => x.id === source?.doc_id)
  return s ? `${s.title}${s.edition ? ` (${s.edition})` : ''}` : 'A standard in the knowledge base'
}

export function Citations({ item, checklist }: { item: Item; checklist: Checklist }) {
  if (item.citations.length === 0) {
    return (
      <Text className="text-sm text-muted-foreground">
        {item.flags.includes('uncited') ? 'No standard covers this item.' : "From Marsh's report template."}
      </Text>
    )
  }
  return (
    <View className="gap-3">
      {item.citations.map((c) => {
        const source = checklist.sources[c.ref]
        return (
          <View key={c.ref} className="gap-1 rounded-md bg-muted p-3">
            <Text className="font-medium">{standardName(checklist.standards, source)}</Text>
            {pages(source) && <Text className="text-sm text-muted-foreground">{pages(source)}</Text>}
            <Text className="text-sm">{`“${c.quote}”`}</Text>
            {!c.quoteFound && <Text className="text-sm font-medium text-warning-foreground">Unverified</Text>}
          </View>
        )
      })}
    </View>
  )
}
