// The lucide icons the gateway names in a summary (the checks' `icon` values, the glance
// tiles and the checklist areas) mapped to the phone's own, so the icons match the web.
// Used by components/GapRow and Glance. An unknown name draws a dot, never nothing. A component
// (not a function returning one), so the lint rule against making components during render holds.
import {
  Archive, ArchiveX, BookOpen, Calculator, CalendarClock, Calendar, CalendarX, Camera, Check, CircleAlert, CircleCheck,
  CircleDot, Clock, CloudLightning, ClipboardCheck, Eye, EyeOff, Factory, FileClock, FileDiff, FileMinus, FilePen,
  FilePlus, FileQuestion, FileText, FileX, Files, Flame, Footprints, HardHat, Hourglass, Info, Layers, LayoutList,
  Lightbulb, ListChecks, ListX, Loader, MessageCircleQuestion, MessageSquare, Mic, Pen, Pencil, Plus, Quote,
  RefreshCw, Search, Shield, Sparkles, Stamp, Tag, TriangleAlert, User, UserSearch, Users, type LucideIcon,
} from 'lucide-react-native'

const ICONS: Record<string, LucideIcon> = {
  archive: Archive, 'archive-x': ArchiveX, 'book-open': BookOpen, calculator: Calculator, calendar: Calendar,
  'calendar-clock': CalendarClock, 'calendar-x': CalendarX, camera: Camera, check: Check, 'circle-alert': CircleAlert,
  'circle-check': CircleCheck, clock: Clock, 'cloud-lightning': CloudLightning, 'clipboard-check': ClipboardCheck,
  eye: Eye, 'eye-off': EyeOff, factory: Factory, 'file-clock': FileClock, 'file-diff': FileDiff, 'file-minus': FileMinus,
  'file-pen': FilePen, 'file-plus': FilePlus, 'file-question': FileQuestion, 'file-text': FileText, 'file-x': FileX,
  files: Files, flame: Flame, footprints: Footprints, 'hard-hat': HardHat, hourglass: Hourglass, info: Info,
  layers: Layers, 'layout-list': LayoutList, lightbulb: Lightbulb, 'list-checks': ListChecks, 'list-x': ListX,
  loader: Loader, 'message-circle-question': MessageCircleQuestion, 'message-square': MessageSquare, mic: Mic,
  pen: Pen, pencil: Pencil, plus: Plus, quote: Quote, 'refresh-cw': RefreshCw, search: Search, shield: Shield,
  sparkles: Sparkles, stamp: Stamp, tag: Tag, 'triangle-alert': TriangleAlert, user: User, 'user-search': UserSearch,
  users: Users,
}

/** Returns whether the phone has an icon for this gateway name (a reply with an unknown one draws no icon, never a dot). */
export const hasIcon = (name: string) => Object.hasOwn(ICONS, name)

/** Draws the phone's icon for a gateway icon name, or a dot. */
export function GatewayIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const Icon = ICONS[name] ?? CircleDot
  return <Icon color={color} size={size} />
}
