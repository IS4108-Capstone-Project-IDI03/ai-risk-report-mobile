// A form label with the web's red star when the field is required (MB-21; the web's design-system
// Combobox and DatePicker draw the label, then "*" in the danger colour). The star is read out as
// "required" rather than "star". Called by screens/NewAssessment, NewSiteFields and the calendar's DateField.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Props = { children: string; required?: boolean; header?: boolean; className?: string }

export function FieldLabel({ children, required, header, className }: Props) {
  return (
    <View
      accessible={required || undefined}
      accessibilityRole={header ? 'header' : undefined}
      accessibilityLabel={required ? `${children}, required` : undefined}
      className="flex-row items-center"
    >
      <Text accessibilityRole={header && !required ? 'header' : undefined} className={cn(header ? 'text-base font-bold' : 'text-sm font-medium', className)}>{children}</Text>
      {required && <Text accessibilityElementsHidden importantForAccessibility="no" className={cn('ml-1 text-destructive', header ? 'text-base font-bold' : 'text-sm font-medium')}>*</Text>}
    </View>
  )
}
