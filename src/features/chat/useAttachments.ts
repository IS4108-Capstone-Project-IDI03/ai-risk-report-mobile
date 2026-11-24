// What is attached to the question being written (MB-24, web CB-08 and CB-09): up to 3 photos and the
// PDFs of this chat. Each file is uploaded the moment it is chosen, so a refusal shows before the
// question is sent. Called by components/Composer. Calls api.ts and capture/media.ts (the camera).
import * as DocumentPicker from 'expo-document-picker'
import { useRef, useState } from 'react'
import { choosePhotos, takePhoto } from '@/features/capture/media'
import { mediaUri } from '@/features/observations/format'
import { errorText } from '@/lib/api'
import { removePdf, removePhoto, uploadPdf, uploadPhoto, type PdfUpload, type Sent } from './api'

const MAX_PHOTOS = 3
// The gateway's limit for one chat (MAX_PDFS_PER_CHAT in chat-pdf.service.ts). The web story says one;
// the gateway allows three, so the phone follows the gateway.
const MAX_PDFS = 3
const PDF_LIMIT = `A chat can use up to ${MAX_PDFS} PDFs. Start a new chat to use more.`

// `blur` is the engineer's choice when faces were found: the blurred copy (the default) or the photo as it is.
export type PhotoItem = { uri: string; id: string; faces: number; blurredId: string | null; blur: boolean }

// What to draw for a photo: the blurred copy (from the gateway) while Blur faces is on, as the web does,
// so the engineer sees what the AI will get. Otherwise the photo itself. Used by AttachmentRow and the sent bubble.
export const shownUri = (p: PhotoItem) => (p.blur && p.blurredId ? mediaUri(`/api/chat/photos/${p.blurredId}`) : p.uri)

// What `take` hands to the chat: the files to draw in my question, and the ids to send with it.
export type Taken = { photos: PhotoItem[]; pdfs: PdfUpload[]; sent: Sent }

// `pdfsHeld`: the PDFs this chat already holds, from the questions asked in it.
export function useAttachments(pdfsHeld: number) {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [pdfs, setPdfs] = useState<PdfUpload[]>([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Counted at once, not from state (a render late), so two quick picks cannot pass a limit.
  const counts = useRef({ photos: 0, pdfs: 0 })

  async function addPhotos(uris: string[]) {
    for (const uri of uris) {
      if (counts.current.photos >= MAX_PHOTOS) return setError(`Attach up to ${MAX_PHOTOS} photos to a question.`)
      counts.current.photos += 1
      setUploading((n) => n + 1)
      try {
        const up = await uploadPhoto(uri)
        // Blur is the default when faces were found (the web's too).
        setPhotos((all) => [...all, { uri, ...up, blur: up.faces > 0 }])
      } catch (e) {
        counts.current.photos -= 1
        setError(errorText(e))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function addPdf(uri: string, name: string) {
    counts.current.pdfs += 1
    setUploading((n) => n + 1)
    try {
      const up = await uploadPdf(uri, name)
      setPdfs((all) => [...all, up])
    } catch (e) {
      counts.current.pdfs -= 1
      setError(errorText(e))
    } finally {
      setUploading((n) => n - 1)
    }
  }

  // One choice from the Attach card (components/AttachMenu): asks for access first (capture/media.ts), says when it is off.
  async function choose(kind: 'camera' | 'library' | 'pdf') {
    setError(null)
    if (kind === 'pdf') {
      if (pdfsHeld + counts.current.pdfs >= MAX_PDFS) return setError(PDF_LIMIT)
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })
      if (!picked.canceled) await addPdf(picked.assets[0].uri, picked.assets[0].name)
      return
    }
    const picked = await (kind === 'camera' ? takePhoto() : choosePhotos())
    if ('denied' in picked) setError(picked.denied)
    else if ('uris' in picked) await addPhotos(picked.uris)
  }

  // The file leaves the list at once; the gateway's copy is removed in the background (a failure only
  // leaves an unused file there, which the gateway clears with the chat).
  function dropPhoto(item: PhotoItem) {
    counts.current.photos -= 1
    setPhotos((all) => all.filter((p) => p.id !== item.id))
    removePhoto(item.id).catch(() => {})
  }
  function dropPdf(item: PdfUpload) {
    counts.current.pdfs -= 1
    setPdfs((all) => all.filter((p) => p.id !== item.id))
    removePdf(item.id).catch(() => {})
  }
  const setBlur = (id: string, blur: boolean) => setPhotos((all) => all.map((p) => (p.id === id ? { ...p, blur } : p)))

  // Hands over what is attached and empties the box, for the question being sent.
  function take(): Taken {
    const attachments = photos.map((p) => (p.blur && p.blurredId ? p.blurredId : p.id))
    const taken = { photos, pdfs, sent: { ...(attachments.length && { attachments }), ...(pdfs.length && { pdfs: pdfs.map((p) => p.id) }) } }
    setPhotos([])
    setPdfs([])
    setError(null)
    counts.current = { photos: 0, pdfs: 0 }
    return taken
  }

  return { photos, pdfs, uploading, error, choose, dropPhoto, dropPdf, setBlur, take }
}
