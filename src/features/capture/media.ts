// The phone's camera and photo library for the capture sheet (MB-03 AC3, AC6,
// AC8, AC14), through expo-image-picker. Asks for access first and says when
// it's off, rather than failing silently.
import * as ImagePicker from 'expo-image-picker'

export type Picked = { uris: string[] } | { canceled: true } | { denied: string }

export const DENIED = {
  camera: 'Camera access is off. Turn it on in Settings to take photos.',
  library: 'Photo library access is off. Turn it on in Settings to add photos.',
  microphone: 'Microphone access is off. Turn it on in Settings to record voice notes.',
}

// 0.8 quality keeps a photo well under the gateway's 20 MB limit. 'compatible'
// asks iOS for JPEG rather than HEIC, which the gateway refuses (415).
const OPTIONS = {
  mediaTypes: ['images'],
  quality: 0.8,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
} satisfies ImagePicker.ImagePickerOptions

export async function takePhoto(): Promise<Picked> {
  if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return { denied: DENIED.camera }
  const result = await ImagePicker.launchCameraAsync(OPTIONS)
  return result.canceled ? { canceled: true } : { uris: result.assets.map((a) => a.uri) }
}

export async function choosePhotos(): Promise<Picked> {
  if (!(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted)
    return { denied: DENIED.library }
  const result = await ImagePicker.launchImageLibraryAsync({ ...OPTIONS, allowsMultipleSelection: true })
  return result.canceled ? { canceled: true } : { uris: result.assets.map((a) => a.uri) }
}
