// From React Native Reusables (shadcn/ui for React Native), badge component.
// Changed for Site Capture: IBM Plex weights, web Badge tones, 8px corners
// rather than a pill (MB-07). Trimmed to the status tones the app uses.
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

const badgeVariants = cva(
  'border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-sm border px-2 py-0.5',
  {
    variants: {
      variant: {
        // Status tones from the web app's Badge (design-system/components/display/Badge.tsx).
        neutral: 'bg-muted border-transparent',
        info: 'bg-info border-transparent',
        success: 'bg-success border-transparent',
        warning: 'bg-warning border-transparent',
        critical: 'bg-critical border-transparent',
        high: 'bg-high border-transparent',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

const badgeTextVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      neutral: 'text-muted-foreground',
      info: 'text-info-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      critical: 'text-critical-foreground',
      high: 'text-high-foreground',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

type BadgeProps = React.ComponentProps<typeof View> & React.RefAttributes<View> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
