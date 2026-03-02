import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardStep {
  label: string
  description?: string
}

interface WizardProgressProps {
  steps: WizardStep[]
  currentStep: number
  onStepClick?: (step: number) => void
  completedSteps?: number[]
}

export function WizardProgress({ steps, currentStep, onStepClick, completedSteps = [] }: WizardProgressProps) {
  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index)
          const isCurrent = index === currentStep
          const isClickable = onStepClick && (isCompleted || isCurrent || index < currentStep)

          return (
            <li key={index} className="flex items-center gap-2 flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full',
                  isCurrent && 'bg-primary text-primary-foreground',
                  isCompleted && !isCurrent && 'bg-primary/10 text-primary hover:bg-primary/20',
                  !isCurrent && !isCompleted && 'bg-muted text-muted-foreground',
                  isClickable && !isCurrent && 'cursor-pointer',
                  !isClickable && 'cursor-default',
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  isCurrent && 'bg-primary-foreground text-primary',
                  isCompleted && !isCurrent && 'bg-primary text-primary-foreground',
                  !isCurrent && !isCompleted && 'bg-muted-foreground/20 text-muted-foreground',
                )}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden sm:inline truncate">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={cn(
                  'h-px flex-1 min-w-4',
                  isCompleted ? 'bg-primary/40' : 'bg-border',
                )} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
