// "How to record a walk" (MB-16 AC36): a short explanation of parts, photos, notes and Finish. The web's
// help sheet, in the phone's words. Opened from the recorder (screens/WalkRecording).
import { Text } from '@/components/ui/text'
import { Sheet } from './Sheet'

const STEPS = [
  ['Record in parts', 'Tap Record and talk as you walk. Tap Pause to hold it and Resume to go on, or Stop to save the part. Start another part whenever you like. A part stops by itself at 20 minutes.'],
  ['Take photos', 'Tap Photo. The part you are recording is saved, the camera opens, and a new part starts when you come back. Each photo is tied to where you were in the walk.'],
  ['Type notes', 'Type a note and tap Add note. You can edit or remove it afterwards. A note you have typed but not added stays on this phone.'],
  ['No signal', 'Everything is kept on this phone first and sent when there is signal.'],
  ['Finish walk', 'When you are done, tap Finish walk and name it. It is then transcribed and turned into proposed observations, which you review before they are added.'],
]

export function HelpSheet({ onClose }: { onClose(): void }) {
  return (
    <Sheet title="How to record a walk" testID="help-sheet" onClose={onClose}>
      {STEPS.map(([title, text]) => (
        <Text key={title} className="text-base">
          <Text className="font-semibold">{`${title}. `}</Text>
          {text}
        </Text>
      ))}
    </Sheet>
  )
}
