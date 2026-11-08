# A2603 — Site Capture (mobile)

The risk engineer's phone app for the AI Risk Report Generator, Capstone Project
A2603 for Marsh Singapore (commercial property insurance broker). Engineers use it on
site to capture what they see: notes, voice recordings, photos and handwritten pages,
filed by location and tagged by COPE category (Construction, Occupancy, Protection,
Exposure).

Writing, reviewing and exporting the report stays on the web app
([ai-risk-report-generator](../ai-risk-report-generator)), because engineers don't
write reports on site. The same goes for the knowledge base and admin screens.

## Architecture

The app is a client of the web repo's API gateway (`server`, port 4000) and nothing
else. It never calls MongoDB, S3 or an AI service directly. Transcription, photo
reading and the chatbot all run behind the gateway, so its privacy masking and cost
logging still apply.

| Piece | Choice |
| --- | --- |
| Framework | Expo SDK 58, React Native 0.88, TypeScript |
| Navigation | Expo Router: each file in `src/app/` is a screen |
| UI | [React Native Reusables](https://reactnativereusables.com) (the shadcn/ui port for React Native) styled with NativeWind v4 (Tailwind for React Native) |
| Look | The web's design system v2 (`docs/design-system-v2.md` in the web repo): the system font (San Francisco on iOS, Roboto on Android), Marsh navy `#000f47` for primary buttons and the header, ink-600 for links and tints, pill buttons, 48px touch targets (the web's are 40) |
| Icons | `lucide-react-native` (the web app uses Lucide too) |
| Sign-in | The gateway's `session` cookie, which React Native's `fetch` stores on both platforms |
| Tests | Jest (`jest-expo`) and React Native Testing Library, with the gateway mocked |

## What's built

**MB-01: sign in, my assessments, bottom tabs** (branch `MB-01`)

- **Sign in** with the gateway (`POST /api/auth/login`). The session is reused on
  launch (`GET /api/auth/me`), and any later 401 returns to sign-in with a "session
  ended" notice. No signal, a Wi-Fi login page or a missing `.env` each say what failed.
- **Home:** the engineer's assessments (`GET /api/assessments`), every status except
  archived, with pull to refresh. Rows aren't tappable yet.
- **Chatbot:** a placeholder. It makes no calls.
- **Profile:** the engineer's name and role, and Sign out.

**MB-02: assessment workspace and locations** (branch `MB-02`)

- **Workspace:** tap an assessment on Home to see its summary, where you are, and what's
  been captured at that location (`GET /api/assessments/:reference/observations`).
  Opening it never starts a capture session.
- **Location picker:** locations grouped by building, then level (lowest first), then
  "Elsewhere on site" (logic copied from the web client's `locations.ts`). **Add
  location** takes a building, optional level and location, with tap-to-fill chips
  (`POST /api/assessments/:reference/locations`).
- **The chosen location** is kept per assessment while the app is open. It belongs to
  the engineer who chose it, so another engineer on a shared phone starts fresh.

**MB-03: capture an observation** (branch `MB-03`)

- **New observation** (one button in the workspace) opens one form, with a section for
  each kind of content an observation can hold: a note, photos (camera or library),
  voice notes (tap to start and stop) and scanned handwritten notes.
- COPE categories are optional (none is saved as `null`). Severity is required, and
  Save says what's missing.
- Saving starts the capture session (`POST .../capture-session`), then uploads the
  observation as multipart (`POST .../observations`). Saved voice notes and scans are
  transcribed by the gateway, which costs money.

**MB-04: find assessments on Home** (branch `MB-04`)

- A search box (site, client or report ID), date chips (Overdue, Due soon, Site visits
  within 7 days, with counts) and status chips. Each card shows its report deadline.
- Filtering happens on the phone. The date rules are copied from the web dashboard.

**MB-06: ask the knowledge base** (branch `MB-06`)

- The Chatbot tab asks the gateway's `POST /api/chat` and shows each answer as it
  streams in (server-sent events, parsed with OpenUI's `@openuidev/lang-core`, the same
  answer format as the web). The loader and search step follow the web.
- Numbered citations open their passage (`GET /api/chat/passages/:id`), with the
  document's name from `GET /api/knowledge-documents/ingested`. Also: starter
  questions, follow-ups, Stop, Try again and New chat.
- Every answer is a paid model call. The conversation lasts while the app is open.

**MB-07: site flow redesign** (branch `MB-07`)

- **Home:** a "Capturing now" card for the assessment whose capture started most recently, one tap back
  into it. Search in a navy band, and one scrolling row of date and status chips.
- **Workspace:** the assessment's details in a navy band, and a bottom bar with where
  you are right above New observation. Observations show their first photo.
- **Location picker:** "Where are you?", with search by name.
- **New observation:** Take photo, Record and Scan page as big buttons at the bottom,
  with counts; everything added in one Evidence tray; severity before COPE.
- **Corners are rounder than the web's** (8 to 20px; the web capped them at 8px then).
  Superseded by design system v2 (6 Nov): the web is rounder too, and the app matches it.

**MB-09: tablet layout and iPad split view** (branches `MB-08`, `MB-09`)

- Tablets (shortest side 600pt or more) turn with the device; phones stay portrait.
- The site screens keep a 640pt column, centred, so nothing stretches on an iPad.
- On a window 900pt or wider, Home shows the list beside the chosen assessment's
  workspace. It opens on the latest capturing assessment; tapping a row switches it.
- On a tablet, New observation is a centred sheet, in two columns at 640pt or wider.

**MB-10: offline capture** (branch `MB-10`)

- With no signal, Home, workspaces and the location picker show the last copy the phone
  saved, with "You're offline. Showing what was saved on this device."
- Saving an observation or adding a location offline queues it ("Waiting to upload").
  Photos, voice notes and scans are copied into the app's own storage.
- The queue uploads when the gateway is reachable again: the app comes to the front, a
  screen refreshes, or every 30 seconds while items wait. Locations go first.
- **Sign in with no signal:** an engineer who has signed in on the phone before signs in
  again with the same email and password. The phone checks them against a salted hash
  kept in its keychain (never the password). It forgets the hash if the gateway refuses
  that email and password. Uploads wait for a sign-in with a signal.
- Each engineer has their own folder on the phone. Refused items show "Couldn't upload"
  with Discard. Home shows how many are waiting.
- With no signal at launch, the app carries on as the last engineer who signed in.
- Known gateway gaps (web story for the team): a lost reply can upload one observation
  twice, and the gateway stamps the upload time, not the capture time.

**MB-11: open an observation** (branch `MB-11`)

- Tap an observation in the workspace to read all of it: the full note, severity, COPE
  tags, location, who captured it and when, photos and handwritten pages at full width
  (with each page's transcript), and voice notes with Play, Pause and their transcript
  status. View only; editing is CP-08.
- Observations waiting to upload open read-only from what is saved on the phone. Offline,
  media not on the phone says "Not available offline". A removed observation says "This
  observation isn't available".
- No new gateway call: the detail finds its observation in the workspace list. It is its
  own screen on the phone and the iPad.

## What to build next

The MVP order, agreed 27 Oct 2026 (MB-01 to MB-04 and MB-06 to MB-11 are built). Each is its own story (`MB-0n`). The web stories it
mirrors are in the web repo's `docs/USER_STORIES.md`.

| Order | Story | Mirrors | Gateway support |
| --- | --- | --- | --- |
| MB-05 | Pre-survey checklist in the workspace, to tick off on site | CP-11, CP-12 (Could) | **None yet.** Teammates are building CP-11 in the web repo. Until then, use a dummy checklist (see below). |

Separate web story for the team: make severity optional. It's required in the gateway
model, the save rule and `report_sections` evidence, and the web UI assumes it.

Later, outside the MVP: editing my captures (CP-08). Completing an assessment (CP-14)
was dropped on the web.

Things to know before building these:

- **The checklist starts as a dummy** (Miya, 27 Oct). Groupmates own CP-11 (generating
  the checklist) in the web repo. Build the screen against sample items kept in one
  file, behind one function (for example `getChecklist(reference)`). Then swapping in
  the real gateway route later changes only that function. Mark the sample data
  clearly as sample in the UI, so nobody mistakes it for a real checklist.

- **Opening capture can reopen a completed assessment.** `POST /capture-session` starts
  a new session when the last one is complete, which turns the status back to
  "capturing". So call it when the first observation is saved, not when an assessment
  is opened.
- **Archived assessments refuse capture** (409), which is why Home hides them.
- **Upload limits:** recordings are up to 25 MB (WebM, Ogg, MP4, M4A, MP3, WAV or FLAC).
  Photos and pages are JPG or PNG, up to 20 MB each.
- **The 15-minute inactivity logout** (the web app's F-07) applies here too. Decide how
  it should work before the offline queue, since an engineer may be offline longer.
- **Real AI calls cost money.** Transcription, photo reading and chat answers each
  make one. Tests mock every gateway call.

## Project structure

```
src/
  app/                    Expo Router routes only; each re-exports a screen
    _layout.tsx           fonts, session check, sign-in vs tabs, workspace screens
    sign-in.tsx
    (tabs)/               bottom tabs: index (Home), chat, profile
    assessment/[reference]/  index (workspace), locations (picker modal), capture (sheet)
  features/
    auth/                 session.tsx, screens/SignIn
    assessments/          api, format, filters (search, date rules), components/, screens/AssessmentList, Workspace
    locations/            api, locations.ts (grouping, copied from web), current.tsx (chosen
                          location), components/, screens/LocationPicker
    observations/         api, format, components/ (ObservationCard, detail pieces), screens/ObservationDetail
    capture/              draft (upload format), media (camera, library), useVoiceNote, api,
                          components/ (sections, chips), screens/CaptureSheet
    chat/                 library (answer format), events (stream), answer (citations),
                          useConversation, components/, screens/Chat
    profile/              screens/Profile
  components/ui/          React Native Reusables components, adjusted
  lib/                    api.ts (every gateway call), utils.ts (cn), nav.ts (header styles)
__tests__/                tests; never put them inside src/app/
test/gateway.tsx          shared test helpers: mocked gateway, sample data, route map
test/setup.ts             default mocks for the camera and recorder (Jest has no phone)
tailwind.config.js        design tokens (exact hex from the web app)
```

## Running locally

You need Node 22, Xcode with an iOS simulator (or Expo Go on a phone), and the web
repo's stack running.

1. In `../ai-risk-report-generator`, start the stack: `docker compose up`. The gateway
   runs on port 4000.
2. Here, install dependencies: `npm install`.
3. Copy `.env.example` to `.env`, and set `EXPO_PUBLIC_API_URL` to your computer's
   Wi-Fi IP address (`ipconfig getifaddr en0`), not `localhost`. On a phone,
   `localhost` means the phone itself.
4. Start the app: `npx expo start`, then press `i` for the iOS simulator, or scan the
   QR code with Expo Go on a phone on the same Wi-Fi. Don't set `CI=1`: it turns off
   reloading, so the app keeps showing old code. The simulator has no camera, so use
   From library for photos there.
5. Sign in with a seeded account: `alex.rowe@example.com` / `password123`. To create
   these accounts, run `npm --prefix server run seed` in the web repo.

If the app can't load, check whether your IP address changed. Update `.env`, then
restart with `npx expo start --clear`, because the address is built in when the app
bundles.

## Checks

```
npx jest            # tests, gateway mocked
npx tsc --noEmit    # type-check
npx expo lint       # lint
npx expo-doctor     # Expo config and dependency versions
```

There's no CI yet, so run all four before committing.

## Conventions

- **Add packages with `npx expo install <pkg>`**, not `npm install`, so versions match
  the SDK. Expo changes every SDK, so check the versioned docs
  (`docs.expo.dev/versions/v58.0.0/`) before using an Expo or React Native API. See
  `AGENTS.md`.
- **UI:** add a component by copying it from React Native Reusables into
  `src/components/ui/`, then adjust it. Use the colour names in `tailwind.config.js`.
  Touch targets are at least 48px. Copy follows the web design system: sentence case,
  buttons are verbs, errors state the cause and then the next step, no emoji.
- **Fonts:** the system font only (design system v2). Use the weight classes
  (`font-medium`, `font-semibold`, `font-bold`); numbers that must line up (dates,
  counts, report IDs) use `tabular-nums`. No bundled font.
- **Stories and branches:** `MB-0n` IDs, one branch per story
  (`git switch -c MB-0n --no-track`), and one commit per finished behaviour with its
  test.
- **Gateway changes** an MB story needs go in the web repo, on their own branch,
  following that repo's CLAUDE.md.
- **Never commit `.env`.**
