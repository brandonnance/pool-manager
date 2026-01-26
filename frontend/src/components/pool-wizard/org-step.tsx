import { Button } from '@/components/ui/button'
import { OrgMembership } from './types'

interface OrgStepProps {
  organizations: OrgMembership[]
  selectedOrgId: string | null
  onSelect: (orgId: string) => void
  onNext: () => void
}

/**
 * Step 1: Organization Selection
 *
 * Allows users with multiple organizations to select which one
 * to create the pool in. Skipped if user has only one org.
 */
export function OrgStep({ organizations, selectedOrgId, onSelect, onNext }: OrgStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Organization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which organization to create this pool in.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {organizations.map((membership) => (
          <button
            key={membership.org_id}
            type="button"
            onClick={() => onSelect(membership.org_id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedOrgId === membership.org_id
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{membership.organizations.name}</div>
            <div className="text-sm text-gray-500 mt-1 capitalize">
              {membership.role}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!selectedOrgId}>
          Continue
        </Button>
      </div>
    </div>
  )
}
