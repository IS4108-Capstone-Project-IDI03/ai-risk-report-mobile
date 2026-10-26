// `cn` joins class names and drops ones a later class overrides. From React
// Native Reusables; used by every component in src/components/ui/.
import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// In tailwind.config.js a weight class (font-semibold) sets the font family, as
// font-mono does. Marking the two groups as conflicting keeps only the last one,
// so `font-normal font-mono` ends up mono rather than depending on CSS order.
const twMerge = extendTailwindMerge({
  extend: {
    conflictingClassGroups: {
      'font-family': ['font-weight'],
      'font-weight': ['font-family'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
