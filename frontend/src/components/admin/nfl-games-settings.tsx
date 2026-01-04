'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface NflGame {
  name: string
  round: string
  display_order: number
}

interface NflGamesSettingsProps {
  initialGames: NflGame[]
}

const ROUND_OPTIONS = [
  { value: 'wild_card', label: 'Wild Card' },
  { value: 'divisional', label: 'Divisional' },
  { value: 'conference', label: 'Conference' },
  { value: 'super_bowl', label: 'Super Bowl' },
]

const ROUND_COLORS: Record<string, string> = {
  wild_card: 'bg-amber-100 text-amber-800 border-amber-300',
  divisional: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  conference: 'bg-red-100 text-red-800 border-red-300',
  super_bowl: 'bg-purple-100 text-purple-800 border-purple-300',
}

export function NflGamesSettings({ initialGames }: NflGamesSettingsProps) {
  const router = useRouter()
  const [games, setGames] = useState<NflGame[]>(initialGames)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleUpdateGame = (index: number, field: keyof NflGame, value: string | number) => {
    setGames(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setHasChanges(true)
  }

  const handleAddGame = () => {
    const maxOrder = games.reduce((max, g) => Math.max(max, g.display_order), 0)
    setGames(prev => [
      ...prev,
      { name: 'New Game', round: 'wild_card', display_order: maxOrder + 1 }
    ])
    setHasChanges(true)
  }

  const handleRemoveGame = (index: number) => {
    setGames(prev => prev.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setGames(prev => {
      const updated = [...prev]
      const currentOrder = updated[index].display_order
      const prevOrder = updated[index - 1].display_order
      updated[index].display_order = prevOrder
      updated[index - 1].display_order = currentOrder
      return updated.sort((a, b) => a.display_order - b.display_order)
    })
    setHasChanges(true)
  }

  const handleMoveDown = (index: number) => {
    if (index === games.length - 1) return
    setGames(prev => {
      const updated = [...prev]
      const currentOrder = updated[index].display_order
      const nextOrder = updated[index + 1].display_order
      updated[index].display_order = nextOrder
      updated[index + 1].display_order = currentOrder
      return updated.sort((a, b) => a.display_order - b.display_order)
    })
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const supabase = createClient()

    // Renumber display_order to be sequential
    const orderedGames = games.map((g, i) => ({ ...g, display_order: i + 1 }))

    const { error } = await supabase
      .from('site_settings')
      .update({ value: orderedGames })
      .eq('key', 'nfl_playoff_games')

    if (error) {
      console.error('Error saving NFL games:', error)
      alert('Failed to save settings')
    } else {
      setGames(orderedGames)
      setHasChanges(false)
      router.refresh()
    }

    setIsSaving(false)
  }

  const sortedGames = [...games].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="space-y-4">
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedGames.map((game, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={ROUND_COLORS[game.round]}>
                {ROUND_OPTIONS.find(r => r.value === game.round)?.label}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="h-8 w-8"
                >
                  <span className="sr-only">Move up</span>
                  <GripVertical className="h-4 w-4 rotate-90" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveGame(index)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Game Name</Label>
                <Input
                  value={game.name}
                  onChange={(e) => handleUpdateGame(index, 'name', e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Round</Label>
                <Select
                  value={game.round}
                  onValueChange={(value) => handleUpdateGame(index, 'round', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Game Name</TableHead>
              <TableHead className="w-40">Round</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGames.map((game, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono text-muted-foreground">
                  {game.display_order}
                </TableCell>
                <TableCell>
                  <Input
                    value={game.name}
                    onChange={(e) => handleUpdateGame(index, 'name', e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={game.round}
                    onValueChange={(value) => handleUpdateGame(index, 'round', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUND_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="h-8 w-8"
                      title="Move up"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === sortedGames.length - 1}
                      className="h-8 w-8"
                      title="Move down"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveGame(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Remove game"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleAddGame}>
          <Plus className="mr-2 h-4 w-4" />
          Add Game
        </Button>

        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        )}
      </div>
    </div>
  )
}
