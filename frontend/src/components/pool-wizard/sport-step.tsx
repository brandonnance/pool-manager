import { Button } from '@/components/ui/button'
import { Sport, SPORT_INFO } from './types'

interface SportStepProps {
  selectedSport: Sport | null
  onSelect: (sport: Sport) => void
  onBack: () => void
  onNext: () => void
}

/**
 * Step 2: Sport Selection
 *
 * Allows users to choose between NFL and PGA sports.
 * Each sport has different pool types available.
 */
export function SportStep({ selectedSport, onSelect, onBack, onNext }: SportStepProps) {
  const sports: Sport[] = ['nfl', 'pga']

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Sport</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the sport for your pool.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sports.map((sport) => {
          const info = SPORT_INFO[sport]
          return (
            <button
              key={sport}
              type="button"
              onClick={() => onSelect(sport)}
              className={`p-6 rounded-lg border text-left transition-all ${
                selectedSport === sport
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">{info.icon}</div>
              <div className="font-medium text-lg">{info.name}</div>
              <div className="text-sm text-gray-500 mt-1">{info.description}</div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedSport}>
          Continue
        </Button>
      </div>
    </div>
  )
}
