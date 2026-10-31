// Location picker (MB-02 AC7-AC12): a modal over the workspace with two views,
// the list to choose from and the Add location form. Choosing or saving sets
// the assessment's current location (current.tsx) and closes the modal.
// MB-07 AC8: a search box narrows the list by name. iOS shows the modal as a
// sheet from the bottom, which swipes down to close.
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn, readable } from '@/lib/utils'
import { SearchBar } from '@/features/assessments/components/SearchBar'
import { addLocation, listLocations } from '../api'
import { AddLocationForm, type NewLocation } from '../components/AddLocationForm'
import { LocationList } from '../components/LocationList'
import { useCurrentLocation } from '../current'
import type { Location } from '../locations'

export default function LocationPicker() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const [chosen, setChosen] = useCurrentLocation(reference)
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  // False once the modal has closed, so a save that finishes late doesn't
  // navigate back a second time and pop the workspace too.
  const open = useRef(true)
  useEffect(() => () => void (open.current = false), [])

  // State is set in the promise's callbacks, once the reply arrives.
  const load = useCallback(
    () =>
      listLocations(reference).then(
        (all) => {
          setLocations(all)
          setError(null)
        },
        (e: Error) => setError(e.message),
      ),
    [reference],
  )
  useEffect(() => {
    load()
  }, [load])

  // Android's back button leaves the form for the list rather than closing the
  // picker and losing what was typed. (iOS: swipe-down is off while adding.)
  useEffect(() => {
    if (!adding) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setAdding(false)
      return true
    })
    return () => sub.remove()
  }, [adding])

  function choose(location: Location) {
    setChosen(location)
    if (open.current) router.back()
  }

  // Errors are left to the form to show; it stays open so nothing typed is lost.
  async function save(details: NewLocation) {
    choose(await addLocation(reference, details))
  }

  // By name, any case (AC8). The groups are kept, so a match shows its building.
  const text = search.trim().toLowerCase()
  const shown = (locations ?? []).filter((l) => l.name.toLowerCase().includes(text))

  return (
    <>
      <Stack.Screen
        options={{
          title: adding ? 'Add location' : 'Where are you?',
          gestureEnabled: !adding,
          headerLeft: adding
            ? () => (
                <Button variant="header" accessibilityLabel="Back to locations" onPress={() => setAdding(false)} className="px-2">
                  <Text>Back</Text>
                </Button>
              )
            : undefined,
          headerRight: () => (
            <Button variant="header" accessibilityLabel="Close" onPress={() => router.back()} className="px-2">
              <Text>Close</Text>
            </Button>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerClassName={cn('gap-4 p-4', readable)} keyboardShouldPersistTaps="handled">
            {error ? (
              <View className="gap-3 rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{error}</Text>
                <Button variant="outline" accessibilityLabel="Try again" onPress={load}>
                  <Text>Try again</Text>
                </Button>
              </View>
            ) : !locations ? (
              <ActivityIndicator className="mt-8" color="#2c5488" />
            ) : adding ? (
              <AddLocationForm locations={locations} onSave={save} />
            ) : (
              <>
                {locations.length > 0 && (
                  <SearchBar
                    label="Search locations"
                    placeholder={`Search ${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`}
                    value={search}
                    onChange={setSearch}
                  />
                )}
                {search.trim() && !shown.length ? (
                  <Text className="px-4 py-6 text-center text-muted-foreground">No location matches. Add it below.</Text>
                ) : (
                  <LocationList locations={shown} chosenId={chosen?.id} onChoose={choose} />
                )}
              </>
            )}
          </ScrollView>
          {/* In thumb reach at the bottom, under the list. */}
          {locations && !adding && (
            <View className="border-t border-border bg-card p-4">
              <View className={readable}>
                <Button size="lg" variant="secondary" accessibilityLabel="Add location" onPress={() => setAdding(true)}>
                  <Plus color="#22406c" size={20} />
                  <Text>Add location</Text>
                </Button>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}
