// A site's locations by building and level (MB-02, mirrors CP-16). Copied from
// the web client's ai-risk-report-generator/client/src/features/assessments/
// locations.ts (labels, level order, grouping) so both apps list places alike.
// Keep the two in step.

// A location as the gateway sends it (LocationDto in location.service.ts).
export type Location = {
  id: string
  building: string | null
  floor: string | null
  name: string
}

export const ELSEWHERE = 'Elsewhere on site'
export const WHOLE_BUILDING = 'Whole building'
export const NO_BUILDING = 'Building not recorded'

// Offered on the Level field, so levels are spelt the way they sort.
export const LEVEL_SUGGESTIONS = [
  'Basement 2',
  'Basement 1',
  'Ground',
  'Level 1',
  'Level 2',
  'Level 3',
  'Mezzanine',
  'Roof',
]

type Place = Pick<Location, 'building' | 'floor' | 'name'>

// The place as shown on screen, general to specific: "Block A · Level 2 ·
// Staircase", "Elsewhere on site · Fire access route".
export function locationLabel(l: Partial<Place>) {
  return [l.building || (l.floor ? null : ELSEWHERE), l.floor, l.name].filter(Boolean).join(' · ')
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const sameName = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

// A level it recognises, in its standard spelling: "L2" is Level 2, "B1" is
// Basement 1, "GF" is Ground. null for a name it doesn't know, e.g. Podium.
// The gateway saves levels the same way (standardLevel in location.service.ts).
function standardLevel(level: string): string | null {
  const l = level.trim().toLowerCase().replace(/\s+/g, ' ')
  let m = /^(?:basement|b) ?(\d+)$/.exec(l)
  if (m) return 'Basement ' + Number(m[1])
  if (l === 'basement') return 'Basement'
  if (/^(?:lower ground|lg)$/.test(l)) return 'Lower ground'
  if (/^(?:ground|ground floor|g|gf)$/.test(l)) return 'Ground'
  if (/^(?:upper ground|ug)$/.test(l)) return 'Upper ground'
  if (/^(?:mezzanine|mezz)$/.test(l)) return 'Mezzanine'
  if (/^(?:roof|rooftop|roof level)$/.test(l)) return 'Roof'
  m =
    /^(?:level|lvl|l|floor|storey) ?(\d+)$/.exec(l) ?? /^(\d+)(?:st|nd|rd|th)?(?: floor)?$/.exec(l)
  if (m) return 'Level ' + Number(m[1])
  return null
}

// A level as the gateway will save it, e.g. for a location queued offline
// (MB-10): "L2" becomes "Level 2"; a name it doesn't know stays as typed.
export const savedLevel = (level: string) => standardLevel(level) ?? level.trim()

// The same building, level and name: the gateway's duplicate rule (409), used
// to find a queued location that turned out to be listed already (MB-10 AC6).
export const samePlace = (a: Place, b: Place) =>
  sameName(a.building, b.building) &&
  sameName(a.floor && savedLevel(a.floor), b.floor && savedLevel(b.floor)) &&
  sameName(a.name, b.name)

const RANKS: Record<string, number> = {
  Basement: -1,
  'Lower ground': -0.5,
  Ground: 0,
  'Upper ground': 0.5,
  Mezzanine: 1.5,
  Roof: 10000,
}

// Where a level sorts, lowest first: basements, ground, numbered levels, a
// mezzanine just above Level 1, then the roof. null for an unknown name.
function levelRank(level: string): number | null {
  const standard = standardLevel(level)
  if (!standard) return null
  const m = /^(Basement|Level) (\d+)$/.exec(standard)
  if (m) return m[1] === 'Basement' ? -Number(m[2]) : Number(m[2])
  return RANKS[standard]
}

export type LevelGroup = {
  // Shown above its locations: a level, Whole building, or null elsewhere on site.
  title: string | null
  locations: Location[]
}
export type LocationGroup = {
  key: string
  // A building, Elsewhere on site, or Building not recorded.
  title: string
  levels: LevelGroup[]
}

// Locations in one building (or with none) by level: the whole building
// first, then lowest first, unknown levels last in the order added. Each
// level's locations in name order.
function byLevel(list: Location[], whole: string | null): LevelGroup[] {
  const levels: LevelGroup[] = []
  for (const l of list) {
    const title = l.floor || whole
    const level = levels.find((x) => sameName(x.title, title))
    if (level) level.locations.push(l)
    else levels.push({ title, locations: [l] })
  }
  const rank = (title: string | null) =>
    !title || title === whole ? -Infinity : (levelRank(title) ?? Infinity)
  return levels
    .map((level, added) => ({ level, added }))
    .sort((a, b) => rank(a.level.title) - rank(b.level.title) || a.added - b.added)
    .map(({ level }) => ({
      ...level,
      locations: [...level.locations].sort((a, b) => collator.compare(a.name, b.name)),
    }))
}

// The picker's groups (CP-16 AC5): each building in name order, then
// Elsewhere on site, then any with a level but no building (saved before CP-16).
export function groupLocations(list: Location[]): LocationGroup[] {
  const buildings: { title: string; locations: Location[] }[] = []
  for (const l of list.filter((x) => x.building)) {
    const building = buildings.find((b) => sameName(b.title, l.building))
    if (building) building.locations.push(l)
    else buildings.push({ title: l.building!, locations: [l] })
  }
  const elsewhere = list.filter((l) => !l.building && !l.floor)
  const unplaced = list.filter((l) => !l.building && l.floor)
  return [
    ...buildings
      .sort((a, b) => collator.compare(a.title, b.title))
      .map((b) => ({
        key: 'building:' + b.title.toLowerCase(),
        title: b.title,
        levels: byLevel(b.locations, WHOLE_BUILDING),
      })),
    ...(elsewhere.length
      ? [{ key: 'elsewhere', title: ELSEWHERE, levels: byLevel(elsewhere, null) }]
      : []),
    ...(unplaced.length
      ? [{ key: 'unplaced', title: NO_BUILDING, levels: byLevel(unplaced, null) }]
      : []),
  ]
}

// Names already used, once each whatever the case, in the order first used,
// then the given suggestions not already among them. Feeds the tap-to-fill chips.
export function suggestions(used: (string | null | undefined)[], extra: string[] = []) {
  const names: string[] = []
  for (const name of [...used, ...extra])
    if (name && !names.some((n) => sameName(n, name))) names.push(name)
  return names
}
