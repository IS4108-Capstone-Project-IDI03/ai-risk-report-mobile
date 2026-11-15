// The review screen's state (MB-16 AC13-AC18): loads the walk and the assessment's locations,
// applies the engineer's edits, saves the whole proposal shortly after the last edit (autosave) and
// runs Create all. Called by screens/WalkReview. Calls ./api and ./proposal.
import * as Crypto from 'expo-crypto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '@/lib/api'
import type { Cope, VoiceNote } from '@/features/capture/draft'
import { listLocations } from '@/features/locations/api'
import type { Location } from '@/features/locations/locations'
import type { Severity } from '@/features/observations/format'
import { createAll, getWalk, renameWalk, retryWalk, saveProposal, uploadProposalMedia, type Proposal, type SiteWalk } from './api'
import { addObservation, createProblem, linkLocation } from './proposal'

// How long after the last edit the proposal is saved. Mirrors the web's AUTOSAVE_MS.
export const AUTOSAVE_MS = 800

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'failed'

// An observation written by hand (AC27): where it goes is one of the proposal's places, or one of
// the assessment's own, which joins the proposal linked.
export type Place = { ref: string } | { existing: Location }
export type NewByHand = { note: string; copeDimension: Cope | null; severity: Severity; place: Place; photos: string[]; pages: string[]; recordings: VoiceNote[] }

export function useProposal(reference: string, walkId: string) {
  const [walk, setWalk] = useState<SiteWalk | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [existing, setExisting] = useState<Location[]>([])
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [problem, setProblem] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The edits not yet saved; null once the latest is on the gateway.
  const unsaved = useRef<Proposal | null>(null)
  // The proposal as it is now, including edits not yet shown or saved.
  const latest = useRef<Proposal | null>(null)
  // The save on its way, if any. One at a time: an older save finishing last would otherwise
  // overwrite newer edits while the screen says "Saved".
  const running = useRef<Promise<boolean> | null>(null)
  // Each file's id on the gateway, so a retried Save sends the same ids and the walk keeps one copy.
  const mediaIds = useRef(new Map<string, string>())

  // a. Load the walk, and the assessment's locations an observation can be moved to.
  useEffect(() => {
    let live = true
    Promise.all([getWalk(reference, walkId), listLocations(reference).catch(() => [] as Location[])]).then(
      ([w, locations]) => {
        if (!live) return
        setWalk(w)
        latest.current = w.proposal ?? null
        setProposal(w.proposal ?? null)
        setExisting(locations)
      },
      (e) => live && setProblem(errorText(e)),
    )
    return () => {
      live = false
    }
  }, [reference, walkId])

  // Saves the latest edits now; false when it failed, so the screen stays and says why.
  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    while (running.current) await running.current
    const next = unsaved.current
    if (!next) return true
    setSaveState('saving')
    const run = saveProposal(reference, walkId, next).then(
      () => {
        // An edit made while saving stays unsaved and goes next.
        if (unsaved.current === next) {
          unsaved.current = null
          setSaveState('saved')
        }
        return true
      },
      (e) => {
        setSaveState('failed')
        setProblem(errorText(e))
        return false
      },
    )
    running.current = run
    try {
      return await run
    } finally {
      running.current = null
    }
  }, [reference, walkId])

  // b. Every edit: shown at once, saved shortly after the last one.
  const change = useCallback(
    (edit: (p: Proposal) => Proposal) => {
      // From the latest proposal held outside React, so a quick Done then Back still sees this edit
      // (a state updater may run late, and must not have side effects).
      const current = latest.current
      if (!current) return
      const next = edit(current)
      latest.current = next
      unsaved.current = next
      setProposal(next)
      setSaveState('unsaved')
      setProblem(null)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
    },
    [save],
  )

  // Leaving the screen saves what is pending, so no edit is lost.
  useEffect(() => () => void save(), [save])

  // c. Create all: save, check, then add everything once. True when it went through.
  const create = useCallback(async () => {
    if (!proposal) return false
    const refused = createProblem(proposal)
    if (refused) {
      setProblem(refused)
      return false
    }
    setCreating(true)
    try {
      if (!(await save())) return false
      await createAll(reference, walkId)
      return true
    } catch (e) {
      setProblem(errorText(e))
      return false
    } finally {
      setCreating(false)
    }
  }, [proposal, save, reference, walkId])

  // A walk that failed or isn't ready yet: Try again re-runs it (one paid AI step).
  const retry = useCallback(async () => {
    setProblem(null)
    try {
      setWalk(await retryWalk(reference, walkId))
    } catch (e) {
      setProblem(errorText(e))
    }
  }, [reference, walkId])

  // d. Add an observation by hand (AC27): upload each file to the walk (a repeat changes nothing), then add
  // the observation, which autosave sends. Throws the gateway's reason, and nothing is added.
  const addByHand = useCallback(
    async (input: NewByHand) => {
      const idFor = (uri: string) => mediaIds.current.get(uri) ?? mediaIds.current.set(uri, Crypto.randomUUID()).get(uri)!
      const files = [
        ...input.recordings.map((n) => ({ kind: 'voice' as const, uri: n.uri })),
        ...input.photos.map((uri) => ({ kind: 'photo' as const, uri })),
        ...input.pages.map((uri) => ({ kind: 'page' as const, uri })),
      ]
      let latest: SiteWalk | null = null
      for (const f of files) latest = await uploadProposalMedia(reference, walkId, idFor(f.uri), f.kind, f.uri)
      // The walk's list of added files, so the new photos show; the proposal on screen is left alone.
      const media = latest?.media
      if (media) setWalk((w) => (w ? { ...w, media } : w))
      change((cur) => {
        const linked = 'ref' in input.place ? { proposal: cur, ref: input.place.ref } : linkLocation(cur, input.place.existing)
        return addObservation(linked.proposal, { note: input.note, copeDimension: input.copeDimension, severity: input.severity, locationRef: linked.ref }, files.map((f) => idFor(f.uri))).proposal
      })
    },
    [reference, walkId, change],
  )

  // Renames the walk (AC25). Throws the gateway's reason, which the header shows.
  const rename = useCallback(
    async (name: string) => {
      const renamed = await renameWalk(reference, walkId, name)
      setWalk((w) => (w ? { ...w, name: renamed.name } : w))
    },
    [reference, walkId],
  )

  return { walk, proposal, existing, saveState, problem, creating, change, save, create, retry, rename, addByHand }
}
