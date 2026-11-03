// The capture sheet's bottom buttons (MB-07 AC9, AC11, AC12): Take photo,
// Record and Scan page, each with a badge counting what it has added, then
// links to add photos or scans taken earlier. Record turns into a red Stop
// with the timer while recording. Used by screens/CaptureSheet, which owns
// the draft and the recorder.
import { Camera, Images, Mic, ScanText, Square, type LucideIcon } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { duration, type Draft } from '../draft'

type Props = {
  draft: Draft
  recording: boolean
  durationMillis: number
  busy: boolean // saving
  onPhoto(): void
  onRecord(): void
  onStop(): void
  onScan(): void
  onPhotoLibrary(): void
  onScanLibrary(): void
}

export function CaptureButtons(p: Props) {
  const { photos, recordings, pages } = p.draft
  // Off while saving, so nothing is added after the upload started and then
  // lost when the sheet closes; and while recording, since the camera would
  // take the microphone's audio session and cut the recording short.
  const locked = p.busy || p.recording
  return (
    <View className="gap-1">
      <View className="flex-row gap-2">
        <Big label="Take photo" text="Take photo" count={photos.length} Icon={Camera} onPress={p.onPhoto} disabled={locked} />
        {p.recording ? (
          <Big label="Stop recording" text={`Stop ${duration(p.durationMillis)}`} Icon={Square} onPress={p.onStop} danger />
        ) : (
          <Big label="Record voice note" text="Record" count={recordings.length} Icon={Mic} onPress={p.onRecord} disabled={p.busy} />
        )}
        <Big label="Scan handwritten notes" text="Scan page" count={pages.length} Icon={ScanText} onPress={p.onScan} disabled={locked} />
      </View>
      {/* Small on purpose: taking a photo stays one tap; the library is the rarer case. */}
      <View className="flex-row justify-center gap-4">
        <Button variant="link" accessibilityLabel="Add photo from library" disabled={locked} onPress={p.onPhotoLibrary} className="h-12 px-1">
          <Images color="#2c5488" size={16} />
          <Text className="text-sm">Photo from library</Text>
        </Button>
        <Button variant="link" accessibilityLabel="Add scan from library" disabled={locked} onPress={p.onScanLibrary} className="h-12 px-1">
          <Images color="#2c5488" size={16} />
          <Text className="text-sm">Scan from library</Text>
        </Button>
      </View>
    </View>
  )
}

type BigProps = {
  label: string
  text: string
  count?: number
  Icon: LucideIcon
  onPress(): void
  danger?: boolean
  disabled?: boolean
}

// One 64px button with its icon over its verb, sized for gloves. The badge in
// its corner says how many it has added (AC9).
function Big({ label, text, count = 0, Icon, onPress, danger, disabled }: BigProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // The count as a value, so the button's name stays the same as it grows.
      accessibilityValue={count ? { text: `${count} added` } : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-16 flex-1 items-center justify-center gap-1 rounded-md border',
        danger ? 'border-destructive bg-destructive active:bg-destructive/90' : 'border-[#c4d9f6] bg-secondary active:bg-[#d6e6fc]',
        disabled && 'opacity-50',
      )}
    >
      <Icon color={danger ? '#ffffff' : '#22406c'} fill={danger ? '#ffffff' : 'none'} size={22} />
      <Text className={cn('text-sm font-semibold', danger ? 'text-white' : 'text-secondary-foreground')}>{text}</Text>
      {count > 0 && (
        <View className="absolute right-1.5 top-1.5 h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5">
          <Text className="font-mono text-xs text-primary-foreground">{count}</Text>
        </View>
      )}
    </Pressable>
  )
}
