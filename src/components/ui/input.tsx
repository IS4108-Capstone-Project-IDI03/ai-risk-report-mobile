// From React Native Reusables (shadcn/ui for React Native), input component.
// Changed for Site Capture: 48px controls, IBM Plex weights. Native and light only.
import { cn } from '@/lib/utils';
import { TextInput } from 'react-native';

function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-input bg-background text-foreground placeholder:text-muted-foreground/50 flex h-12 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base font-normal leading-5 shadow-sm shadow-black/5',
        props.editable === false && 'opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
