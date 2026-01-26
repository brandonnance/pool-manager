import { Button } from '@/components/ui/button'
import { Sport, PoolType, SquaresMode, SPORT_POOL_TYPES, POOL_TYPE_INFO } from './types'

interface PoolTypeStepProps {
  sport: Sport
  selectedType: PoolType | null
  selectedMode: SquaresMode | null
  onSelect: (type: PoolType, mode?: SquaresMode) => void
  onBack: () => void
  onNext: () => void
}

/**
 * Step 3: Pool Type Selection
 *
 * Shows available pool types for the selected sport.
 * For NFL Playoff Squares, also allows selecting full playoff vs single game mode.
 */
export function PoolTypeStep({
  sport,
  selectedType,
  selectedMode,
  onSelect,
  onBack,
  onNext,
}: PoolTypeStepProps) {
  const availableTypes = SPORT_POOL_TYPES[sport]

  // For NFL, show mode selection as sub-options
  const showModeSelection = sport === 'nfl' && selectedType === 'playoff_squares'

  const canContinue = selectedType && (selectedType !== 'playoff_squares' || selectedMode)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Pool Type</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the type of pool you want to create.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {availableTypes.map((type) => {
          const info = POOL_TYPE_INFO[type]
          const isSelected = selectedType === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type, type === 'playoff_squares' ? 'full_playoff' : undefined)}
              className={`p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{info.name}</div>
              <div className="text-sm text-gray-500 mt-1">{info.description}</div>
            </button>
          )
        })}
      </div>

      {/* Mode selection for Squares */}
      {showModeSelection && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onSelect('playoff_squares', 'full_playoff')}
              className={`p-4 rounded-lg border text-left transition-all ${
                selectedMode === 'full_playoff'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Full Playoff</div>
              <div className="text-sm text-gray-500 mt-1">
                13 games from Wild Card to Super Bowl
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSelect('playoff_squares', 'single_game')}
              className={`p-4 rounded-lg border text-left transition-all ${
                selectedMode === 'single_game'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Single Game</div>
              <div className="text-sm text-gray-500 mt-1">
                One game (e.g., Super Bowl only)
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  )
}
