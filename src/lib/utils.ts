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

// A readable column on a tablet (MB-09): 640pt at most, centred. Wider than a
// phone, so phones look the same. Used inside the site screens' lists, bands
// and bottom bars.
export const readable = 'w-full max-w-[640px] self-center'
