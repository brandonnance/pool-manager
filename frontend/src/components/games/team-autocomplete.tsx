'use client'

import { useState, useRef, useEffect } from 'react'

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface TeamAutocompleteProps {
  teams: Team[]
  selectedTeamId: string
  onSelect: (teamId: string) => void
  placeholder?: string
  label?: string
  id?: string
}

export function TeamAutocomplete({
  teams,
  selectedTeamId,
  onSelect,
  placeholder = 'Search for a team...',
  label,
  id,
}: TeamAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Get the selected team object
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  // Filter teams based on query
  const filteredTeams = query.trim()
    ? teams.filter((team) => {
        const searchLower = query.toLowerCase()
        return (
          team.name.toLowerCase().includes(searchLower) ||
          (team.abbrev && team.abbrev.toLowerCase().includes(searchLower))
        )
      }).slice(0, 20) // Limit to 20 results for performance
    : []

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredTeams.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (team: Team) => {
    onSelect(team.id)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onSelect('')
    setQuery('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredTeams.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredTeams.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredTeams[highlightedIndex]) {
          handleSelect(filteredTeams[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {selectedTeam ? (
        // Show selected team
        <div className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
          <div className="flex items-center gap-2">
            {selectedTeam.logo_url && (
              <img
                src={selectedTeam.logo_url}
                alt=""
                className="w-6 h-6 object-contain"
              />
            )}
            <span className="text-gray-900">
              {selectedTeam.name}
              {selectedTeam.abbrev && (
                <span className="text-gray-500 ml-1">({selectedTeam.abbrev})</span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        // Show search input
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(e.target.value.trim().length > 0)
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true)
            }}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setIsOpen(false), 200)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />

          {/* Dropdown */}
          {isOpen && filteredTeams.length > 0 && (
            <ul
              ref={listRef}
              className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg"
            >
              {filteredTeams.map((team, index) => (
                <li
                  key={team.id}
                  onClick={() => handleSelect(team)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-900'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {team.logo_url && (
                    <img
                      src={team.logo_url}
                      alt=""
                      className="w-6 h-6 object-contain flex-shrink-0"
                    />
                  )}
                  <span className="truncate">
                    {team.name}
                    {team.abbrev && (
                      <span className="text-gray-500 ml-1">({team.abbrev})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* No results message */}
          {isOpen && query.trim() && filteredTeams.length === 0 && (
            <div className="absolute z-10 w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-lg text-gray-500 text-sm">
              No teams found matching "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
