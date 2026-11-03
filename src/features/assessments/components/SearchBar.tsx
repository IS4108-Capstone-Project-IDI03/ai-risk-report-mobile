// Home's search box (MB-04 AC1-AC2): site, client or report ID, with a clear
// button while there's text. Used by screens/AssessmentList, and with its own
// label by the location picker (MB-07 AC8).
import { Search, X } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Input } from '@/components/ui/input'

const LABEL = 'Search site, client or report ID' // the web dashboard's wording

type Props = { value: string; onChange(text: string): void; label?: string; placeholder?: string }

export function SearchBar({ value, onChange, label = LABEL, placeholder = label }: Props) {
  return (
    <View className="justify-center">
      <View className="absolute left-3 z-10" pointerEvents="none">
        <Search color="#545e6b" size={20} />
      </View>
      <Input
        accessibilityLabel={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="bg-card pl-11 pr-12"
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChange('')}
          className="absolute right-0 h-12 w-12 items-center justify-center"
        >
          <X color="#545e6b" size={18} />
        </Pressable>
      )}
    </View>
  )
}
