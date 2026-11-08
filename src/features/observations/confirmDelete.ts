// The question before a delete (MB-12 AC9), the same Alert as Discard in MB-10.
// Called by ObservationDetail and the workspace's swipe row; `onConfirm` does the delete.
import { Alert } from 'react-native'

export function confirmDelete(onConfirm: () => void) {
  Alert.alert('Delete this observation?', 'It leaves the list and the report draft. It is kept, so it can be restored on the web.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}
