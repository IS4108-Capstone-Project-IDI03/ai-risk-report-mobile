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
- **Pin where I am (9 Nov, branch `MB-02-gps-pin`; web CP-26):** Add location has an optional
  **Pin where I am** that reads the phone's GPS once, when tapped, and saves `coordinates` with the
  location (`expo-location`). Permission off or no fix says so and saving still works. A location
  queued with no signal keeps its pin.
- **Remove a location (20 Nov):** swipe a saved location left in the picker to show **Remove**. It asks first, then sends
  `DELETE .../locations/:id` and reads the list again. If it was the chosen location, you choose again. A location with
  observations (deleted ones too) or waiting to upload has no Remove; if the gateway still refuses, its words are shown.
  Online only ("Connect to remove."). Editing a location stays on the web.
- **Site pins:** a **Site pins** button in the workspace band opens the site and its blocks, each with
  its pin or "Not pinned" (`site.coordinates` and `site.pins` from `GET /api/assessments`).
  Each place saved with no building ("Elsewhere on site") has a row and a marker too, and its pin is kept on the location; a location
  inside a building has none (its building's pin stands for every level). **Directions** opens Google Maps directions (no key). **Edit pin** (or **Set pin**) opens a panel:
  tap the map, use the phone's position, or type `lat, lng`, then **Set** (`PUT /api/sites/:id/map`,
  one change at a time); **Remove pin** is there too. A map (`react-native-maps`, Apple Maps on
  iOS) shows a marker for each pin (S, 1, 2…), which can be dragged to move; **Hide map** folds it.
  On a wide iPad it is two columns, the map on the left and the rows on the right. Pins are shared
  by every visit to the site. Android needs a Google Maps key in store builds (not set up).

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
- Every answer is a paid model call. (Chats are now kept: see MB-14.)

**MB-14: saved chats** (branch `MB-14`, web CB-03 / CB-06; the web docs disagree on the IDs)

- **Kept on the gateway.** The first question creates a chat (`POST /api/chat/conversations`,
  named from the question), then every question goes to `POST /api/chat` with its `threadId`.
  Each message carries an id (the phone makes a question's, the stream sends an answer's), so
  the gateway keeps follow-ups in order.
- **Reopens.** The last chat's id is kept in the engineer's own folder; the Chatbot tab opens
  on it after a restart. A chat deleted elsewhere is forgotten. A restored answer shows its
  text and citations, not the "searched for" step (the gateway keeps text only).
- **The list.** The two-line button at the header's left (ChatGPT's) opens a navy sidebar:
  search (`?q=`, name or any message), newest first, tap to open, "…" or press and hold for
  Rename and Delete (asks first), New chat at the bottom. On a phone the whole chat, header
  included, slides aside to show it (Reanimated, on the UI thread; the pushed chat greys and
  blurs a little; tap or swipe it to close). On a wide iPad it is a column beside the chat. The
  plain list is kept on the phone, so it opens offline; search needs signal.
- **Header.** The Chatbot screen draws its own navy bar (the tab bar's is off here) so it slides
  with the chat. Adds `expo-blur`.
- **Tests.** Jest swaps Reanimated for a stand-in (`src/lib/reanimated.ts`, `test/reanimated.ts`),
  as it has no UI thread.
- Out of scope: versions of a retried question (CB-04), preferences (CB-05).

**MB-15: chatbot preferences, "memory"** (branch `MB-15`, web CB-05 as the code names it)

- **Where:** a **My preferences** row at the bottom of the chats list (the drawer on a phone, the column
  on a wide iPad) opens a My preferences screen.
- **What:** the switch "Use my preferences in chats" (`PATCH /api/chat/memory`), an **Add a fact** box
  ("N of 200 characters", up to 20 facts, `POST .../facts`), and the facts oldest first with the date
  added. Tap a fact to edit it (Save, Cancel); Delete is inside the edit box and asks first. With the
  switch off the facts are kept and dimmed and the box is hidden. A warning says not to type client
  names or site details.
- **Offline:** the last copy shows read-only ("Connect to change your preferences."). Nothing here is a
  paid call.

**MB-16: site walk** (branch `MB-16`, web CP-22; not in the backlog yet, needs adding)

- **Where:** a **Site walk** button beside New observation opens the Site walks list (newest first, each with its
  status and what it holds; walks already added sit last under "Added to the assessment"). **Start a walk** opens the recorder.
- **Recording:** Record, Pause, Resume and Stop make numbered parts (up to 20 minutes each, "0:42 of 20:00").
  Photo saves the part, opens the camera and starts the next part when it closes (the phone can't run camera and
  microphone together). Typed notes share the numbering and can be edited or removed. The screen stays awake.
  Everything is kept on the phone first and sent when there is signal. Finish walk names the walk and starts the
  gateway's paid steps (transcribing, then the AI proposal).
- **Review** (a Ready walk): observations by location, with a location chooser, Category, Severity, Type and
  Status filters, "N to fix", and Previous and Next. Edit note, severity, category and location (saved as you go),
  delete with Undo and a Deleted list, add, rename, same-as or delete a new location, add an observation by hand
  (with photos, voice notes and pages), and see all photos and handwritten pages. **Create all** asks first, then
  adds everything once (`POST .../create`); the walk then moves to "Added to the assessment", where it can only
  be viewed (the gateway refuses to change a created walk): its locations, observations, photos and recording, read only.
- **Gateway:** all `/api/assessments/:ref/site-walks` routes; no gateway change. The list route returns created
  walks too, and the phone groups them under "Added to the assessment".
- **Needs the web `.env`:** the proposal step reads `TYPESAFE_API_KEY` (Jev classifier). Without it a walk fails
  at "proposing". Send recordings as `audio/m4a` (the app does).
- **Out of scope:** the bell notification, background recording, the web's in-page camera while recording.

**MB-17: scanned pages** (branch `MB-17`, web CP-19 and CP-20; not in the backlog yet, needs adding)

- **Scans:** the Scans screen (a route, `/assessment/<reference>/scans`) lists every handwritten page of the
  assessment's live observations. **The Scans button was taken out of the workspace header on 19 Nov (Miya), so the
  phone has no way to open it for now** (see the MB-17 spec), newest first: thumbnail, its text or status (Reading the handwriting, Couldn't
  read and why, No handwriting found), when it was captured and which observation. Tap a page to open its
  observation. Pull to refresh; pages still being read refresh every 5 seconds. Offline it shows the saved copy, and
  pages still waiting to upload say so.
- **Read again:** on a page that was read, in the observation's detail. It asks first ("This replaces your corrected
  text" if you corrected it), then starts one new reading (`POST .../pages/:pageId/retranscribe`, one paid call).
- **Edit text:** in the **Edit** screen's Media list, beside each page that was read. It opens the page photo and
  its text in a box (Save text, Cancel). Saving keeps the model's first reading and stores yours
  (`PUT .../pages/:pageId/transcript`); the page then says "Corrected by you" and reports are drafted from your text.
  A failed save keeps what you typed.
- **Add, remove and restore pages (17 Nov):** in the Edit screen's Media list, **Scan page** and **Scan from library**
  stage a page ("New page 1 · Added when you save", Discard drops it); Save sends it with any new photos and voice notes
  (`page` parts of `POST .../media`), and the gateway reads each page (one paid call each). **Remove** on a page asks
  first, then lists it under Removed with **Restore** (`DELETE` and `POST .../restore`). As on the web, a photo, voice
  note or page can be removed only while the observation holds something else, counting its note; with one thing left
  there is no Remove, and the screen says to delete the observation instead.
- **Gateway:** nothing of ours. The web's CP-20 on `main` (Xuren, `2b0f7047`) provides the page routes and the
  `transcription.correction` field this app reads. Needs that web `main` running.
- **Out of scope:** the web client showing corrections made on a phone, saving a correction offline, removing a page
  from the detail screen (Edit only).

**MB-19: calendar** (branch `MB-19`, web CP-60; not in the backlog yet, needs adding)

- **Where:** a **Calendar** tab between Home and Chatbot. It reads the same list as Home
  (`GET /api/assessments`) and adds no endpoint. Archived assessments are left out.
- **Phone (changed 19 Nov, Miya):** the month grid, in a rounded card, fills the tab's height, as in Apple Calendar, with
  lines between days. Entries are bars with their site name, as on the web, and each bar opens its
  details: a survey is one bar across all its days in its type's colour and icon (flag, repeat,
  calendar-check), a report due is a white chip in its state's colour and icon. Tap the rest of a day and a sheet slides up with
  its entries (a survey shows on each of its days). Late reports and No survey
  date are under the grid, just below a screen's worth of month. **Wide window (700pt or more):**
  the web's month grid (a survey is one bar across its days, a report due date is a white chip that
  says late, due soon, on track or finalised), three entries a day then "+N more", and a **Week**
  view. The two lists sit beside the grid from 1080pt, under it below that.
- **Move and filter:** arrows, **Today**, Month / Week, Survey dates / Report due dates, and one
  assessment type. The footer's "N reports late" opens the month of the oldest late report. The
  view, period and filters are kept when you open an assessment and come back (the tab stays open).
- **Details:** tap an entry for its site, client, reference, type, status, survey days, report due
  date and site contacts, with **Open assessment** and **Reschedule**.
- **Reschedule and Set dates** (`PUT /api/assessments/:reference`, the web's Edit details route, type
  sent unchanged, a cleared date sent as `''`): native date picker (`@react-native-community/datetimepicker`),
  Save dates greyed until something changes, wrong dates named beside the field before anything is sent.
  Only the assigned engineer can; online only ("Connect to reschedule.").
- **Gateway:** nothing of ours. Needs the web `main` with `siteVisitEndDate` on that route (CP-60, `39a8dd83`).
- **Out of scope:** New Assessment from a day, the admin Engineer filter, dragging an entry, `.ics` export.

**MB-20: next step and gaps, and MarshBot's chat** (branch `MB-20`, web AS-06; not in the backlog yet, needs adding; the chat was MB-20 until 21 Nov, when it was folded in)

- **Where:** on a phone, a full-width **Overview** bar (stage, eight progress segments, one chip, the report's
  due note, a chevron) above the Observations | Checklist switch; tapping it opens MarshBot's chat (below), whose **Summary** opens a sheet with the rest. On an
  iPad, the card with **Hide**. Only the assigned engineer gets it (someone else's: nothing).
- **What it shows:** the stage ("Capture · stage 3 of 8" and eight dots), the one **Next step** (a sentence and a button with a
  verb), the open items most urgent first (Fix now, Gap, Reminder; five, then **Show all N**), the checklist areas that need
  more as bars, and three "At a glance" tiles. Each row opens the checklist, an observation or the site walks; a row that
  points to Generate, Review or Export is greyed and says "Continue on the web." A checklist link opens the Checklist
  (it has no jump to one area yet).
- **Loads** with the workspace, on coming back to it and on pull to refresh. Offline it shows the last copy.
- **Gateway:** `GET /api/assessments/:reference/assistant/summary`, **new, in the web repo on branch `AS-06-summary`** (not merged).
  It is read only: unlike `GET .../assistant` it records no "opened" and starts no paid AI call. The phone never calls that one.
  Until that branch is on the gateway you run, the card shows the gateway's refusal text (a 404).
- **Left out:** dismissing, live push, a stage on Home and the Focus list (see the spec). The chat is below.

**The chat** (was MB-20; the same web story, AS-06):

- **Where:** tapping the Overview bar (phone) opens the chat as its own screen, `/assessment/<reference>/assistant`. **Summary** at
  its top goes back to the workspace with the old Overview sheet open (next step and gaps). The iPad keeps the card.
- **What it shows:** the gateway's status pill, the stage with eight segments, three facts, then the conversation: MarshBot's
  bubbles on the left, yours on the right, each turn as its lines then its cards. Cards drawn: To do (tasks), rows (with a button),
  checklist and area bars. The outline, review lanes and stage-time cards show a title and "See the detail on the web."
- **Replies:** MarshBot's buttons are pinned at the bottom (Skip for now, What else?, Add observations, That's everything, Another
  visit with the native date picker and Confirm). One `POST .../assistant/replies` each, online only ("Connect to reply."). A reply with a
  link (Add observations) only opens it and sends nothing, as the web does. A reply has its icon at the left, a link reply an arrow
  at the right, and the first hint (what a stage move does) is one line under the buttons. The status block has **Hide** on its stage row (folds the segments and the three facts away; the pill, the stage line and Summary stay). A "Try Again" row opens its observation, where the phone's own Try again is (never a paid call from a chat button).
- **Gateway:** nothing of ours. `GET /api/assessments/:ref/assistant` **records an "open" and can start paid AI steps** (a coverage
  check, and the AI rewording of new bot turns), so the phone reads it once when the screen opens, and again after a reply or
  while MarshBot is writing (every 5 s, up to 2 minutes). It sends no activity beacon.
- **Left out:** earlier sessions, the agenda, the AI-worded form of a turn (the phone draws its lines and cards, as the web does
  when a turn has none), the outline, lanes and stage-time cards in full, push when MarshBot finishes.

**MB-21: start a new assessment** (branch `MB-21`, web CP-01 and CP-23, manual form only; not in the backlog yet, needs adding)

- **Where:** a **+ New** button in Home's header opens a **New assessment** screen (a modal).
- **The form:** pick a **client** (a searchable list of the gateway's clients; the list takes the form's place while
  you choose), then one of its **sites** or **Add a new site** (name, address, jurisdiction as two letters, and a facility
  type), then the **visit type** (First survey, Resurvey, Follow-up) and the optional **dates**, with the calendar's native
  date picker. A new site, or one with no visit yet, can only start with a First survey (the gateway's rule), so the
  other two are greyed with the reason.
- **Create assessment** sends one `POST /api/assessments` and opens the new assessment's workspace. A listed site's
  locations are copied from its latest visit (`copyLocations`, the web's default). The gateway's problems show beside
  their fields and the form stays filled in. Online only ("Connect to start an assessment."). Two quick taps send one request.
- **Gateway:** nothing of ours (`POST /api/assessments`, `GET /api/clients`, `GET /api/clients/:id/sites` already exist).
- **Left out:** a new client, contacts, several sites at once, an admin choosing the engineer, reading client documents
  with AI (paid), and "New assessment from a day" in the calendar.

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

**MB-12: manage my observations** (branch `MB-12`)

- **Edit:** Edit on an observation's detail opens a screen for its severity, COPE
  categories and note (`PATCH /api/observations/:id`, only what changed is sent). The
  detail then says "Edited <time> by <name>". Leaving with unsaved changes asks first.
- **Delete:** swipe a card left in the workspace, or tap Delete on the detail, then
  confirm. It is a soft delete: the gateway keeps it. **Show deleted** below the list
  loads the observations deleted at that location, each with Restore.
- **Media:** the edit screen lists the observation's photos, voice notes and handwritten
  pages. Photos and voice notes can be removed (and restored). New ones are added with the
  same big tiles as capture, wait in a "New" row, and are uploaded, and each voice note
  transcribed, only when you tap Save changes. Pages are view-only: the gateway can't add
  or remove them on a saved observation yet (web CP-20).
- **Try again (9 Nov):** a failed voice note or handwritten page shows its reason and a
  **Try again** button on the detail (`POST .../transcription/retry`, 202). It says
  "Transcribing", then the detail reads the observation every 5 seconds for about 2
  minutes until the result shows, then "Still working. Check back soon." One paid AI call
  per tap, never automatic, one note at a time. Greyed offline.
- **Online only.** With no signal Edit and Delete are greyed out ("Connect to edit or
  delete."), the swipe is off, and Show deleted says "Connect to see deleted."
  Observations waiting to upload keep Discard and have none of these.
- Wording: the app says "media", not "evidence", for an observation's photos, voice notes
  and pages. Adds `react-native-gesture-handler` (the swipe row).
- Flags for the web team: pages on a saved observation (CP-20), and a deleted-only filter
  for `?include=deleted`, which now sends every observation.

**MB-05: pre-survey checklist** (branch `MB-05`, web CP-30 and CP-31)

- **Where:** inside the workspace. A switch at the top of the workspace flips between
  **Observations** and **Checklist 12/48** (the progress), so an engineer ticks items as
  they walk the site without leaving the assessment.
- **Read:** `GET /api/assessments/:ref/checklist`. Priority risks first, then the areas,
  then an "Other" group. Unchecked items first. An item expands to show its source, with
  the standard and the quote on tap.
- **Mark:** Not seen and Not applicable (`PUT .../checklist/items/:id/mark`) work offline:
  they queue like observations and show "Waiting to upload".
- **Confirm and Differs:** save an observation at the current location, linked to the
  item (`details.checklistItem`). Confirm starts the note from the item's words, Differs
  from nothing. Severity is required. The item's COPE categories are chosen. With no
  signal it queues. A refused one shows a failed row with Discard and "Save without the
  checklist link".
- **Generate:** a "Standards to use" box (all on) then `POST .../checklist` (about 30
  seconds, online only, `reports:generate` permission). Generate again keeps the answers
  the gateway keeps. With no standards in scope the gateway calls no model.
- **Wide iPad** (workspace 760pt or more): the observations and the checklist show side
  by side, and Confirm and Differs fill the observation form beside the checklist instead
  of a pop-up box. The checklist pane can collapse to a slim bar.
- Not built yet: the regenerate confirm and carry-over notice, the "ask a knowledge admin"
  hint, and testing Generate against the cloud gateway (the local one has no ingested
  standards).

**MB-09 additions (9 Nov, on the `MB-05` branch)**

- **Hide the list:** on the iPad, Hide on the assessments list shrinks it away and puts an
  **Assessments** button in the navy band to bring it back (`AssessmentList`).
- **New observation inside the workspace:** side by side, the form opens in place of the
  observations, with the checklist beside it, both scrollable. Below that width it is the
  capture route as before (`CaptureSheet` takes `onClose`, `embedded` and `answer`).
- **Wide layout:** the workspace fills the width with 32pt side padding, as the web's
  design system does. The location and New observation share one bottom row. The navy band
  can collapse to one line. Panes ease in 260 ms (`src/lib/motion.ts`, skipped under Reduce
  Motion).
- Sheets close with the word **Close**, not an X.

## What to build next

The MVP order, agreed 27 Oct 2026 (MB-01 to MB-12 are all built, and so are MB-16, the site walk, MB-17, scanned pages, MB-19, the calendar, MB-20, next step and gaps, and MB-21, start a new assessment). Each is its own story (`MB-0n`). The web stories it
mirrors are in the web repo's `docs/USER_STORIES.md`.

| Order | Story | Mirrors | Gateway support |
| --- | --- | --- | --- |
| (next) | Chosen from the migration shortlist, agreed with Miya | | |

Separate web story for the team: make severity optional. It's required in the gateway
model, the save rule and `report_sections` evidence, and the web UI assumes it.

Later, outside the MVP: editing my captures (CP-08). Completing an assessment (CP-14)
was dropped on the web.

Things to know before building these:

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
    (tabs)/               bottom tabs: index (Home), calendar, chat, profile
    assessment/[reference]/  index (workspace), locations (picker modal), capture (sheet)
  features/
    auth/                 session.tsx, screens/SignIn
    assessments/          api, format, filters (search, date rules), components/, screens/AssessmentList, Workspace
    locations/            api, locations.ts (grouping, copied from web), current.tsx (chosen
                          location), components/, screens/LocationPicker
    observations/         api, format, confirmDelete, components/ (ObservationCard, SwipeDelete, DeletedSection,
                          MediaSection, detail pieces), screens/ObservationDetail, ObservationEdit
    checklist/            api, format (sections, status), useChecklist, components/ (ChecklistView, ItemRow,
                          AnswerSheet, GenerateSheet, Citations)
    capture/              draft (upload format), media (camera, library), useVoiceNote, api,
                          components/ (sections, chips), screens/CaptureSheet
    chat/                 api (incl. saved chats), library (answer format), events (stream), answer (citations),
                          useConversation, components/ (ChatList, FactRow, FactForm), screens/Chat, Preferences
    calendar/             calendar.ts (dates and layout, copied from the web), api (Reschedule), format,
                          components/ (Toolbar, PhoneMonth, DayEntries, MonthGrid, EntryChip, EntryRow, SideLists, EntryDetails,
                          RescheduleSheet, DateField), screens/Calendar
    new-assessment/       api (clients, sites, create), format (visit and facility types, field errors), useLists,
                          components/ (ClientPicker, SitePicker, NewSiteFields, TypeChips), screens/NewAssessment
    assistant/            api (the conversation, replies), types, poll, useThread, format, components/ (Bubble, CardView, TasksCard,
                          RowsCard, AreaCard, PlainCard, Row, StatusLine, Replies, DateStep), screens/Assistant
    overview/             api (the summary), format (link targets), icons, useSummary, components/ (OverviewCard,
                          StageLine, NextStep, GapRow, AreaBar, Glance)
    profile/              screens/Profile
  components/ui/          React Native Reusables components, adjusted
  lib/                    api.ts (every gateway call), utils.ts (cn), nav.ts (header styles), motion.ts (pane ease)
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
