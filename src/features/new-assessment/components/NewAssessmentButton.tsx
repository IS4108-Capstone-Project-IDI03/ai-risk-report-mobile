// The round plus at the bottom right of Home that starts an assessment (MB-21, redesigned 21 Nov): a floating
// button in thumb reach, so the header keeps only the Inbox icon. Its word is read out, not drawn
// ("New assessment"). Called by AssessmentList, which draws it over the list. Opens /new-assessment.
import { router } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { Button } from '@/components/ui/button'

export function NewAssessmentButton() {
  return (
    <Button
      accessibilityLabel="New assessment"
      onPress={() => router.push('/new-assessment')}
      // 56pt, navy, lifted by a soft shadow so it reads as floating over the rows.
      className="absolute bottom-5 right-4 h-14 w-14 px-0 shadow-lg shadow-black/30"
    >
      <Plus color="#ffffff" size={28} />
    </Button>
  )
}
