'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { WizardProgress } from './wizard-progress'
import { OrgStep } from './org-step'
import { SportStep } from './sport-step'
import { PoolTypeStep } from './pool-type-step'
import { EventStep } from './event-step'
import { SettingsStep } from './settings-step'
import { ReviewStep } from './review-step'
import {
  OrgMembership,
  Sport,
  PoolType,
  SquaresMode,
  SquaresSettings,
  GolfSettings,
  WizardStepDef,
  UpcomingEvent,
  WIZARD_STEPS,
  DEFAULT_SQUARES_SETTINGS,
  DEFAULT_GOLF_SETTINGS,
} from './types'

interface WizardContainerProps {
  userOrgMemberships: OrgMembership[]
  preselectedOrgId?: string
}

/**
 * Main wizard container that manages state and step navigation.
 *
 * State is maintained via URL search params for browser back/forward support.
 * Form data is maintained in React state (not URL) since it can be large.
 */
export function WizardContainer({
  userOrgMemberships,
  preselectedOrgId,
}: WizardContainerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Determine if org step should be skipped
  const hasMultipleOrgs = userOrgMemberships.length > 1
  const skipOrgStep = !hasMultipleOrgs || !!preselectedOrgId

  // URL state
  const currentStep = parseInt(searchParams.get('step') || '1', 10)
  const urlOrgId = searchParams.get('orgId') || preselectedOrgId || ''
  const urlSport = (searchParams.get('sport') || '') as Sport | ''
  const urlPoolType = (searchParams.get('poolType') || '') as PoolType | ''
  const urlMode = (searchParams.get('mode') || '') as SquaresMode | ''
  const urlEventId = searchParams.get('eventId') || ''

  // Form state (not in URL)
  const [eventName, setEventName] = useState('')
  const [squaresSettings, setSquaresSettings] = useState<SquaresSettings>(DEFAULT_SQUARES_SETTINGS)
  const [golfSettings, setGolfSettings] = useState<GolfSettings>(DEFAULT_GOLF_SETTINGS)

  // Derived state
  const effectiveOrgId = urlOrgId || (userOrgMemberships.length === 1 ? userOrgMemberships[0].org_id : '')
  const selectedOrg = userOrgMemberships.find((m) => m.org_id === effectiveOrgId)

  // Determine which steps to show
  const visibleSteps = useMemo<WizardStepDef[]>(() => {
    if (skipOrgStep) {
      // Renumber steps when org is skipped
      return WIZARD_STEPS.filter((s) => s.number > 1).map((s, idx) => ({
        ...s,
        number: idx + 1,
      }))
    }
    return WIZARD_STEPS
  }, [skipOrgStep])

  // Map current step to actual step content
  const getActualStep = (displayStep: number): number => {
    if (skipOrgStep) {
      return displayStep + 1 // Skip org step (1), so display 1 = actual 2
    }
    return displayStep
  }

  const actualStep = getActualStep(currentStep)

  // Navigation helpers
  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`/create-pool?${params.toString()}`)
  }

  const goToStep = (step: number) => {
    updateParams({ step: step.toString() })
  }

  const goBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1)
    }
  }

  const goNext = () => {
    goToStep(currentStep + 1)
  }

  // Step handlers
  const handleOrgSelect = (orgId: string) => {
    updateParams({ orgId })
  }

  const handleSportSelect = (sport: Sport) => {
    // Clear downstream selections when sport changes
    updateParams({ sport, poolType: '', mode: '', eventId: '' })
  }

  const handlePoolTypeSelect = (type: PoolType, mode?: SquaresMode) => {
    updateParams({ poolType: type, mode: mode || '' })
    // Reset settings when pool type changes
    if (type === 'playoff_squares') {
      setSquaresSettings(DEFAULT_SQUARES_SETTINGS)
    } else {
      setGolfSettings(DEFAULT_GOLF_SETTINGS)
    }
  }

  const handleEventSelect = (event: UpcomingEvent) => {
    updateParams({ eventId: event.id })
    setEventName(event.name)

    // Pre-fill settings from event metadata for single game squares
    if (urlPoolType === 'playoff_squares' && urlMode === 'single_game') {
      const metadata = event.metadata as {
        home_team?: string
        away_team?: string
        short_name?: string
        round_name?: string
      }
      // Use round_name (e.g., "AFC Championship") if available, otherwise use the full event name
      const gameName = metadata?.round_name || event.name
      setSquaresSettings((prev) => ({
        ...prev,
        gameName,
        homeTeam: metadata?.home_team || '',
        awayTeam: metadata?.away_team || '',
      }))
    }
  }

  const handleSettingsUpdate = (settings: SquaresSettings | GolfSettings) => {
    if (urlPoolType === 'playoff_squares') {
      setSquaresSettings(settings as SquaresSettings)
    } else {
      setGolfSettings(settings as GolfSettings)
    }
  }

  // Get current settings based on pool type
  const currentSettings = urlPoolType === 'playoff_squares' ? squaresSettings : golfSettings

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          {/* Progress indicator */}
          <WizardProgress steps={visibleSteps} currentStep={currentStep} />

          <div className="mt-8">
            {/* Step 1: Org Selection (conditional) */}
            {actualStep === 1 && !skipOrgStep && (
              <OrgStep
                organizations={userOrgMemberships}
                selectedOrgId={urlOrgId || null}
                onSelect={handleOrgSelect}
                onNext={goNext}
              />
            )}

            {/* Step 2: Sport Selection */}
            {actualStep === 2 && (
              <SportStep
                selectedSport={(urlSport as Sport) || null}
                onSelect={handleSportSelect}
                onBack={skipOrgStep ? () => router.push('/dashboard') : goBack}
                onNext={goNext}
              />
            )}

            {/* Step 3: Pool Type Selection */}
            {actualStep === 3 && urlSport && (
              <PoolTypeStep
                sport={urlSport as Sport}
                selectedType={(urlPoolType as PoolType) || null}
                selectedMode={(urlMode as SquaresMode) || null}
                onSelect={handlePoolTypeSelect}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {/* Step 4: Event Selection */}
            {actualStep === 4 && urlSport && urlPoolType && (
              <EventStep
                sport={urlSport as Sport}
                poolType={urlPoolType as PoolType}
                selectedEventId={urlEventId || null}
                onSelect={handleEventSelect}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {/* Step 5: Pool Settings */}
            {actualStep === 5 && urlPoolType && (
              <SettingsStep
                poolType={urlPoolType as PoolType}
                mode={(urlMode as SquaresMode) || null}
                settings={currentSettings}
                onUpdate={handleSettingsUpdate}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {/* Step 6: Review & Create */}
            {actualStep === 6 && effectiveOrgId && urlSport && urlPoolType && urlEventId && (
              <ReviewStep
                orgId={effectiveOrgId}
                orgName={selectedOrg?.organizations.name || 'Unknown'}
                sport={urlSport as Sport}
                poolType={urlPoolType as PoolType}
                mode={(urlMode as SquaresMode) || null}
                eventId={urlEventId}
                eventName={eventName}
                settings={currentSettings}
                onBack={goBack}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
