// From React Native Reusables (shadcn/ui for React Native), input component.
// Changed for Site Capture: 48px controls, 10px corners (design system v2). Native and light only.
// A field in focus turns its border navy on a white background, eased in over 150 ms (the web's
// "navy focus ring on every control"). Border width and padding stay put, so nothing shifts and
// callers (the search box's icon padding) are not disturbed. Every text field in the app uses this.
import { cn } from '@/lib/utils';
import { TextInput } from 'react-native';

function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-input bg-background text-foreground placeholder:text-muted-foreground/50 flex h-12 w-full min-w-0 flex-row items-center rounded-[10px] border px-3 py-1 text-base font-normal leading-5 shadow-sm shadow-black/5 transition-all duration-150 focus:border-primary focus:bg-card',
        props.editable === false && 'opacity-50',
        className
      )}
      // The caret and selection in Marsh navy, not iOS blue (the app's own look).
      selectionColor="#000f47"
      {...props}
    />
  );
}

export { Input };
