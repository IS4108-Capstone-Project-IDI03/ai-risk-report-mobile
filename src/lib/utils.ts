// `cn` joins class names and drops ones a later class overrides. From React
// Native Reusables; used by every component in src/components/ui/.
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A readable column on a tablet (MB-09): 640pt at most, centred. Wider than a
// phone, so phones look the same. Used inside the site screens' lists, bands
// and bottom bars.
export const readable = 'w-full max-w-[640px] self-center'
