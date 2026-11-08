// From React Native Reusables (shadcn/ui for React Native), button component.
// Changed for Site Capture: 48px controls, a header variant.
// Trimmed to what the app uses: native only, light only, no destructive/sm/icon.
// Design system v2 (6 Nov): pill shape, and a press shrinks it a little.
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

const buttonVariants = cva(
  'group shrink-0 flex-row items-center justify-center gap-2 rounded-full shadow-none active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',
        outline: 'border-border bg-background active:bg-accent border shadow-sm shadow-black/5',
        secondary: 'bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5',
        ghost: 'active:bg-accent',
        link: '',
        // On the navy header (MB-07): no pale pressed fill, which hid the white
        // text; the text just dims while pressed.
        header: 'active:opacity-60',
      },
      size: {
        default: 'h-12 px-5 py-2',
        lg: 'h-14 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('text-foreground text-base font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      outline: 'group-active:text-accent-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'group-active:text-accent-foreground',
      link: 'text-primary group-active:underline',
      header: 'text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type ButtonProps = React.ComponentProps<typeof Pressable> & React.RefAttributes<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant })}>
      <Pressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
