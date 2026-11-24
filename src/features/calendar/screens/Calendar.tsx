// The Calendar tab (MB-19, web CP-60): the engineer's surveys and report due dates by
// month or week, with the late reports and the assessments that have no survey date
// beside it. Drawn from the work list (GET /api/assessments, via listAssessments), as
// the web does, so it shows exactly what the gateway lets this engineer open. On a phone
// the month is a grid with dots that fills the screen, and tapping a day slides up a sheet
// with its entries (as Apple Calendar); from 700pt it is the web's grid of bars, with a Week
// view. Tapping an entry opens its details;
// Reschedule saves through features/calendar/api.ts. Rendered by src/app/(tabs)/calendar.tsx.
// The tab stays mounted, so the view, period and filters are kept when an assessment is
// opened and Back returns here (AC18).
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { listAssessments } from '@/features/assessments/api'
import type { Assessment } from '@/features/assessments/format'
import { useSession } from '@/features/auth/session'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { BottomSheet } from '@/components/BottomSheet'
import { useCalendarGrid, useCalendarSideLists } from '@/lib/device'
import {
  addDays,
  addMonths,
  entriesOn,
  assessmentType,
  dueOf,
  layoutWeek,
  monthStart,
  monthWeeks,
  periodLabel,
  todayIso,
  toItems,
  weekStart,
  type CalendarItem,
  type Show,
  type View as Mode,
} from '../calendar'
import { DayEntries, dayTitle } from '../components/DayEntries'
import { EntryDetails } from '../components/EntryDetails'
import { MonthGrid } from '../components/MonthGrid'
import { PhoneMonth } from '../components/PhoneMonth'
import { RescheduleSheet } from '../components/RescheduleSheet'
import { SideLists } from '../components/SideLists'
import { Toolbar } from '../components/Toolbar'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

export default function Calendar() {
  const me = useSession().user!
  const { offline } = useOffline()
  const grid = useCalendarGrid()
  // The tab's visible height, so a phone's first screen is exactly the banner, filters, month and footer.
  const [viewport, setViewport] = useState(0)
  const sideBySide = useCalendarSideLists()
  const today = todayIso()
  const [assessments, setAssessments] = useState<Assessment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // `picked` is the day chosen in the phone's month grid; `dayOpen` is whether its sheet has slid up.
  const [state, setState] = useState<{ view: Mode; day: string; show: Show; type: string; picked: string }>({ view: 'month', day: today, show: '', type: '', picked: today })
  const [dayOpen, setDayOpen] = useState(false)
  const [open, setOpen] = useState<CalendarItem | null>(null)
  const [rescheduling, setRescheduling] = useState<CalendarItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A change of period or filter shows another month, so a sheet left open would be about the old one.
  const set = (change: Partial<typeof state>) => {
    setState((s) => ({ ...s, ...change }))
    if (change.day !== undefined || change.view !== undefined) setDayOpen(false)
  }

  // Only the newest load may set state, so a slow earlier one (a focus or refresh load
  // that began before a save) can't bring back the old dates.
  const latest = useRef(0)
  const load = useCallback(() => {
    const mine = ++latest.current
    return listAssessments().then(
      (all) => {
        if (mine !== latest.current) return
        setAssessments(all)
        setError(null)
      },
      // A 401 has already sent the engineer to sign-in (src/lib/api.ts).
      (e: unknown) => mine === latest.current && setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])
  // On open, and on coming back from an assessment whose dates may have changed.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )
  async function refresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  // A phone has no week: seven columns do not fit.
  const view: Mode = grid ? state.view : 'month'
  const cursor = view === 'month' ? monthStart(state.day) : weekStart(state.day)
  const items = toItems(assessments ?? [])
  const shown = items.filter((i) => !state.type || assessmentType(i.type) === state.type)
  const late = shown.filter((i) => dueOf(i, today)?.state === 'late').sort((a, b) => a.due!.localeCompare(b.due!))
  const unscheduled = shown.filter((i) => !i.start)
  const filtered = !!state.show || !!state.type

  const step = (by: number) => set({ day: view === 'month' ? addMonths(cursor, by) : addDays(state.day, by * 7) })
  const switchView = (next: Mode) =>
    set({
      view: next,
      // A month opens on today's week when it holds today, else on its first.
      day: next === 'week' && view === 'month' ? (monthStart(today) === cursor ? today : cursor) : state.day,
    })

  const lists = (
    <SideLists
      late={late}
      unscheduled={unscheduled}
      filtered={filtered}
      today={today}
      meId={me.id}
      offline={offline}
      onPress={setOpen}
      onSetDates={setRescheduling}
    />
  )
  const body = (
    // A rounded card. On a phone it takes all the height the banner and filters leave in the first screen.
    <View className={grid ? 'overflow-hidden rounded-lg border border-border bg-card' : 'flex-1 overflow-hidden rounded-lg border border-border bg-card'}>
      {grid ? (
        <MonthGrid
          weeks={view === 'month' ? monthWeeks(shown, cursor, state.show) : [layoutWeek(shown, cursor, state.show)]}
          month={view === 'month' ? cursor.slice(0, 7) : null}
          today={today}
          meId={me.id}
          onEntry={setOpen}
          onWeek={(day) => set({ view: 'week', day })}
        />
      ) : (
        <PhoneMonth
          items={shown}
          month={cursor}
          show={state.show}
          today={today}
          meId={me.id}
          onEntry={setOpen}
          selected={dayOpen ? state.picked : null}
          onSelect={(day) => {
            set({ picked: day })
            setDayOpen(true)
          }}
        />
      )}
      <View className="flex-row flex-wrap items-center justify-between gap-x-4 border-t border-border px-4 py-1">
        <Text className="text-sm text-muted-foreground">{plural(shown.length, 'assessment')}</Text>
        {late.length > 0 && (
          <Pressable
            accessibilityRole="button"
            // To the month of the report longest late, showing reports only.
            onPress={() => set({ view: 'month', day: late[0].due!, show: 'due' })}
            className="h-11 justify-center"
          >
            <Text className="text-sm font-semibold text-destructive">{`${plural(late.length, 'report')} late`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )

  return (
    <View testID="calendar" className="flex-1 bg-background">
      <ScrollView
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        contentContainerClassName="gap-4 p-4"
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* A phone's first screen is one block as tall as the tab (minus the 16pt padding above and
            below), so the month fills it and the lists start just under it. */}
        <View className="gap-4" style={!grid && assessments && viewport ? { height: viewport - 32 } : undefined}>
        <OfflineNote />
        {notice && (
          <View className="rounded-md bg-success p-3">
            <Text className="text-success-foreground">{notice}</Text>
          </View>
        )}
        {error && (
          <View className="rounded-md bg-destructive/10 p-3">
            <Text className="text-destructive">{`Your calendar could not be loaded. ${error}`}</Text>
          </View>
        )}
        <Toolbar
          view={view}
          label={periodLabel(view, cursor)}
          canSwitch={grid}
          show={state.show}
          type={state.type}
          onStep={step}
          onToday={() => set({ day: today, picked: today })}
          onView={switchView}
          onShow={(show) => set({ show })}
          onType={(type) => set({ type })}
        />
        {!assessments ? (
          !error && <Text className="py-6 text-center text-muted-foreground">Loading your calendar…</Text>
        ) : !grid ? (
          body
        ) : sideBySide ? (
          <View className="flex-row items-start gap-4">
            <View className="flex-1">{body}</View>
            <View className="w-[340px]">{lists}</View>
          </View>
        ) : (
          // The iPad's grid has the lists under it.
          <>
            {body}
            {lists}
          </>
        )}
        </View>
        {/* On a phone the lists follow the first screen: scroll to them. */}
        {!grid && assessments && lists}
      </ScrollView>
      {!grid && dayOpen && (
        <BottomSheet testID="day-sheet" title={dayTitle(state.picked, today)} onClose={() => setDayOpen(false)}>
          <DayEntries entries={entriesOn(shown, state.picked, state.show)} today={today} meId={me.id} onPress={setOpen} />
        </BottomSheet>
      )}
      {/* An entry's details slide up as a sheet as tall as their content; Reschedule is a full-height
          form in its own page sheet (a Modal), opened as the details close. */}
      {open && (
        <EntryDetails
          item={open}
          today={today}
          meId={me.id}
          offline={offline}
          onClose={() => setOpen(null)}
          onOpen={() => {
            const reference = open.reference
            setOpen(null)
            router.push({ pathname: '/assessment/[reference]', params: { reference } })
          }}
          onReschedule={() => {
            setRescheduling(open)
            setOpen(null)
          }}
        />
      )}
      <Modal visible={!!rescheduling} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRescheduling(null)}>
        {rescheduling && (
          <RescheduleSheet
            item={rescheduling}
            today={today}
            onClose={() => setRescheduling(null)}
            onSaved={() => {
              setNotice(`Dates saved for ${rescheduling.reference}.`)
              setRescheduling(null)
              load()
            }}
          />
        )}
      </Modal>
    </View>
  )
}
