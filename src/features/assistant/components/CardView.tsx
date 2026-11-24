// Draws one card of a MarshBot turn by its type (MB-20). A type the phone doesn't know (the web may add one) draws
// nothing rather than breaking the conversation. Called by Bubble.
import type { Target } from '@/features/overview/format'
import type { Card } from '../types'
import { AreaCard } from './AreaCard'
import { PlainCard } from './PlainCard'
import { RowsCard } from './RowsCard'
import { TasksCard } from './TasksCard'

export function CardView({ card, onGo }: { card: Card; onGo(target: Target): void }) {
  switch (card.type) {
    case 'tasks':
      return <TasksCard card={card} onGo={onGo} />
    case 'rows':
      return <RowsCard card={card} onGo={onGo} />
    case 'checklist':
    case 'bars':
      return <AreaCard card={card} onGo={onGo} />
    case 'outline':
    case 'lanes':
    case 'stage-time':
      return <PlainCard card={card} />
    default:
      return null
  }
}
