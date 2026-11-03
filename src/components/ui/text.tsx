// From React Native Reusables (shadcn/ui for React Native), text component.
// Changed for Site Capture: IBM Plex weights. Trimmed to what the app uses: one
// style, and a context so Button, Badge and Card can set their text's colour.
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Text as RNText } from 'react-native';

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({ className, ...props }: React.ComponentProps<typeof RNText> & React.RefAttributes<typeof RNText>) {
  const textClass = React.useContext(TextClassContext);
  return <RNText className={cn('text-foreground text-base font-normal', textClass, className)} {...props} />;
}

export { Text, TextClassContext };
