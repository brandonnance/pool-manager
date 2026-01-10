"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import type { MmGame, MmEntry, MmPoolTeam } from "./game-card";

interface BracketViewProps {
  games: MmGame[];
  entries: MmEntry[];
  poolTeams: MmPoolTeam[];
  currentUserId: string | null;
}

// Entry search component
interface EntrySearchProps {
  entries: MmEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string | null) => void;
}

function EntrySearch({ entries, selectedEntryId, onSelect }: EntrySearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the selected entry's display name
  const selectedEntry = entries.find((e) => e.id === selectedEntryId);

  // Filter entries based on query
  const filteredEntries = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return entries
      .filter((e) => e.display_name?.toLowerCase().includes(lowerQuery))
      .slice(0, 8); // Limit to 8 suggestions
  }, [entries, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (entry: MmEntry) => {
    onSelect(entry.id);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {selectedEntry ? (
          <div className="flex items-center gap-2 pl-8 pr-8 py-2 border rounded-md bg-sky-50 border-sky-200">
            <span className="text-sm font-medium text-sky-700 truncate">
              {selectedEntry.display_name}
            </span>
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-sky-100 rounded"
            >
              <X className="h-4 w-4 text-sky-600" />
            </button>
          </div>
        ) : (
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search participant..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-8 pr-4"
          />
        )}
      </div>
      {isOpen && filteredEntries.length > 0 && !selectedEntry && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => handleSelect(entry)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              {entry.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Region = "East" | "West" | "South" | "Midwest";

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

// Matchup slot component - shows one team in a matchup
interface TeamSlotProps {
  team: MmPoolTeam | undefined;
  entry: MmEntry | undefined;
  score: number | null;
  isWinner: boolean;
  isAdvancing: boolean;
  isCurrentUser: boolean;
  isEliminated: boolean;
  isSpreadUpset: boolean; // Team won but owner doesn't advance, OR team lost but owner advances
  spread?: number | null; // Spread to display (only for higher seed/favorite)
}

// Matchup box height constant for gap calculations
// Each team slot is ~40px (seed+team row ~22px + owner row ~14px + padding)
// Two teams = 80px + border = 84px
const MATCHUP_HEIGHT = 84; // px - height of each matchup box

function TeamSlot({
  team,
  entry,
  score,
  isWinner,
  isAdvancing,
  isCurrentUser,
  isEliminated,
  isSpreadUpset,
  spread,
}: TeamSlotProps) {
  // Determine background and border colors based on state
  // In spread upset: highlight the WINNING team (amber), mute the losing team
  // Priority: winner in spread upset (amber) > normal advancing (green) > eliminated (muted) > current user (sky)
  const bgClass = isSpreadUpset && isWinner
    ? "bg-amber-50" // Team won (but owner eliminated due to spread)
    : isSpreadUpset && isAdvancing
    ? "bg-muted/50 opacity-60" // Team lost but owner advances - still mute the losing team
    : isAdvancing
    ? "bg-emerald-50" // Normal advance (team won + covered)
    : isEliminated
    ? "bg-muted/50 opacity-60"
    : isCurrentUser
    ? "bg-sky-50"
    : "bg-background";

  const borderClass = isSpreadUpset && isWinner
    ? "border-l-amber-500" // Winning team in spread upset
    : isAdvancing && !isSpreadUpset
    ? "border-l-emerald-500"
    : isCurrentUser
    ? "border-l-sky-500"
    : "border-l-transparent";

  // Separate strikethrough logic for team vs owner
  // Game is over if someone was eliminated or someone advanced
  const gameIsOver = isEliminated || isAdvancing;
  // Team strikethrough: team lost the game (regardless of whether owner advances via spread)
  const teamLost = gameIsOver && !isWinner;
  const teamStrikethrough = teamLost ? "line-through decoration-red-400/70" : "";
  // Owner strikethrough: owner doesn't advance (regardless of team winning)
  const ownerEliminated = isEliminated && !isAdvancing;
  const ownerStrikethrough = ownerEliminated ? "line-through decoration-red-400/70" : "";

  // Determine if this team lost (for styling purposes)
  const isLoser = teamLost;

  // Text colors - winning team gets highlighted, losing team is muted
  const teamTextClass = isSpreadUpset && isWinner
    ? "text-amber-700" // Team won but owner eliminated (spread upset)
    : isSpreadUpset && isAdvancing
    ? "text-muted-foreground" // Team lost but owner advances - still mute the loser
    : isWinner && isAdvancing
    ? "text-emerald-700" // Normal winner + advancer
    : isWinner
    ? "text-emerald-700"
    : isLoser
    ? "text-muted-foreground"
    : "";

  const seedTextClass = isSpreadUpset && isWinner
    ? "text-amber-600" // Winning team in spread upset
    : isWinner
    ? "text-emerald-600"
    : "text-muted-foreground";

  return (
    <div
      className={`border-b last:border-b-0 border-l-2 ${borderClass} px-1.5 py-1 ${bgClass} ${
        isWinner ? "font-semibold" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-0.5">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span
            className={`text-[10px] font-bold shrink-0 w-3 ${seedTextClass} ${isLoser ? "opacity-50" : ""}`}
          >
            {team?.seed || "?"}
          </span>
          <span
            className={`truncate text-xs font-medium ${teamTextClass} ${teamStrikethrough}`}
          >
            {team?.bb_teams?.abbrev ||
              team?.bb_teams?.name?.slice(0, 5) ||
              "TBD"}
            {spread !== null && spread !== undefined && (
              <span className="ml-0.5 text-[9px] text-muted-foreground font-normal">
                ({spread > 0 ? "+" : ""}{spread})
              </span>
            )}
          </span>
        </div>
        {score !== null && (
          <span
            className={`font-mono font-bold text-xs ${
              isSpreadUpset ? "text-amber-700" : isWinner ? "text-emerald-700" : "text-muted-foreground"
            } ${isLoser ? "opacity-50" : ""}`}
          >
            {score}
          </span>
        )}
      </div>
      <div
        className={`truncate text-[10px] leading-tight ${
          isCurrentUser
            ? "text-sky-600 font-medium"
            : isSpreadUpset && isAdvancing
            ? "text-amber-700 font-medium"
            : "text-muted-foreground"
        } ${ownerStrikethrough}`}
      >
        {entry?.display_name || "—"}
      </div>
    </div>
  );
}

// Single matchup component
interface MatchupProps {
  game: MmGame | null;
  poolTeams: MmPoolTeam[];
  entries: MmEntry[];
  currentUserId: string | null;
  highlightEntryId?: string | null;
  width?: string;
}

function Matchup({
  game,
  poolTeams,
  entries,
  currentUserId,
  highlightEntryId,
  width = "w-[100px]",
}: MatchupProps) {
  if (!game) {
    return (
      <div
        className={`${width} border border-dashed border-muted-foreground/30 rounded-lg bg-muted/30 flex items-center justify-center`}
        style={{ minHeight: MATCHUP_HEIGHT }}
      >
        <span className="text-muted-foreground text-[10px]">TBD</span>
      </div>
    );
  }

  const higherTeam = poolTeams.find((t) => t.id === game.higher_seed_team_id);
  const lowerTeam = poolTeams.find((t) => t.id === game.lower_seed_team_id);
  const higherEntry = entries.find((e) => e.id === game.higher_seed_entry_id);
  const lowerEntry = entries.find((e) => e.id === game.lower_seed_entry_id);

  const isFinal = game.status === "final";
  const higherWins =
    isFinal &&
    game.higher_seed_score !== null &&
    game.lower_seed_score !== null &&
    game.higher_seed_score > game.lower_seed_score;
  const lowerWins =
    isFinal &&
    game.higher_seed_score !== null &&
    game.lower_seed_score !== null &&
    game.lower_seed_score > game.higher_seed_score;

  const advancingEntry = entries.find((e) => e.id === game.advancing_entry_id);
  const higherAdvances = advancingEntry?.id === higherEntry?.id;
  const lowerAdvances = advancingEntry?.id === lowerEntry?.id;

  // Highlight based on selected entry (from search) or current user
  // Note: Only highlight by user_id if currentUserId is not null (to avoid null === null being true)
  const higherIsHighlighted = highlightEntryId
    ? higherEntry?.id === highlightEntryId
    : currentUserId !== null && higherEntry?.user_id === currentUserId;
  const lowerIsHighlighted = highlightEntryId
    ? lowerEntry?.id === highlightEntryId
    : currentUserId !== null && lowerEntry?.user_id === currentUserId;

  const isLive = game.status === "in_progress";
  const hasHighlightedEntry = higherIsHighlighted || lowerIsHighlighted;

  // Spread upset: winning team !== spread covering team
  // This means the winner's owner is eliminated and loser's owner advances
  const isSpreadUpset = isFinal && game.winning_team_id !== null &&
    game.spread_covering_team_id !== null &&
    game.winning_team_id !== game.spread_covering_team_id;

  return (
    <div
      className={`${width} rounded-lg border bg-card shadow-md hover:shadow-lg transition-shadow relative shrink-0 ${
        isLive ? "ring-2 ring-amber-400 ring-offset-1" : ""
      } ${hasHighlightedEntry ? "ring-[3px] ring-sky-500 ring-offset-1 shadow-[0_0_12px_rgba(14,165,233,0.5)]" : ""}`}
    >
      <TeamSlot
        team={higherTeam}
        entry={higherEntry}
        score={game.higher_seed_score}
        isWinner={higherWins}
        isAdvancing={higherAdvances && isFinal}
        isCurrentUser={higherIsHighlighted}
        isEliminated={isFinal && !higherAdvances}
        isSpreadUpset={isSpreadUpset && (higherWins || higherAdvances)}
        spread={game.spread}
      />
      <TeamSlot
        team={lowerTeam}
        entry={lowerEntry}
        score={game.lower_seed_score}
        isWinner={lowerWins}
        isAdvancing={lowerAdvances && isFinal}
        isCurrentUser={lowerIsHighlighted}
        isEliminated={isFinal && !lowerAdvances}
        isSpreadUpset={isSpreadUpset && (lowerWins || lowerAdvances)}
      />
      {isLive && (
        <div className="bg-amber-500 text-white text-center text-[9px] font-bold py-0.5 uppercase tracking-wide rounded-b-lg">
          Live
        </div>
      )}
    </div>
  );
}

// Region column component - renders one region's bracket vertically
interface RegionColumnProps {
  region: Region;
  games: MmGame[];
  poolTeams: MmPoolTeam[];
  entries: MmEntry[];
  currentUserId: string | null;
  highlightEntryId: string | null;
  flowDirection: "right" | "left";
}

// Gap calculations for proper bracket alignment
// Each round's gap = MATCHUP_HEIGHT + previous round's gap
// This centers each game between the two games that feed into it
const GAP_R64 = 6;
const GAP_R32 = MATCHUP_HEIGHT + GAP_R64 - 85; // 82
const GAP_S16 = MATCHUP_HEIGHT + GAP_R32 - 80; // 158
const GAP_E8 = MATCHUP_HEIGHT + GAP_S16; // 234

// Box widths - using fixed pixel values to control total width
const WIDTH_R64 = "w-[120px]";
const WIDTH_R32 = "w-[125px]";
const WIDTH_S16 = "w-[130px]";
const WIDTH_E8 = "w-[135px]";

function RegionColumn({
  region,
  games,
  poolTeams,
  entries,
  currentUserId,
  highlightEntryId,
  flowDirection,
}: RegionColumnProps) {
  // Get games by round for this region
  const r64Games = games
    .filter((g) => g.round === "R64")
    .sort((a, b) => (a.game_number || 0) - (b.game_number || 0));
  const r32Games = games
    .filter((g) => g.round === "R32")
    .sort((a, b) => (a.game_number || 0) - (b.game_number || 0));
  const s16Games = games
    .filter((g) => g.round === "S16")
    .sort((a, b) => (a.game_number || 0) - (b.game_number || 0));
  const e8Games = games.filter((g) => g.round === "E8");

  // Build the rounds array based on flow direction
  const rounds =
    flowDirection === "right"
      ? [
          { key: "R64", games: r64Games, gap: GAP_R64, width: WIDTH_R64 },
          { key: "R32", games: r32Games, gap: GAP_R32, width: WIDTH_R32 },
          { key: "S16", games: s16Games, gap: GAP_S16, width: WIDTH_S16 },
          { key: "E8", games: e8Games, gap: GAP_E8, width: WIDTH_E8 },
        ]
      : [
          { key: "E8", games: e8Games, gap: GAP_E8, width: WIDTH_E8 },
          { key: "S16", games: s16Games, gap: GAP_S16, width: WIDTH_S16 },
          { key: "R32", games: r32Games, gap: GAP_R32, width: WIDTH_R32 },
          { key: "R64", games: r64Games, gap: GAP_R64, width: WIDTH_R64 },
        ];

  // Calculate total height based on R64 (8 games with GAP_R64 gaps)
  const totalHeight = 8 * MATCHUP_HEIGHT + 7 * GAP_R64;

  return (
    <div className="flex flex-col">
      {/* Region header */}
      <div className="text-center mb-3">
        <Badge
          variant="default"
          className="text-xs font-bold uppercase tracking-wider"
        >
          {region}
        </Badge>
      </div>

      {/* Bracket rounds */}
      <div className="flex items-center gap-2">
        {rounds.map((roundData, roundIdx) => {
          const numGames =
            roundData.games.length ||
            Math.pow(
              2,
              3 - (flowDirection === "right" ? roundIdx : 3 - roundIdx)
            );

          return (
            <div
              key={roundData.key}
              className="flex flex-col justify-around"
              style={{ gap: `${roundData.gap}px`, height: totalHeight }}
            >
              {roundData.games.length > 0
                ? roundData.games.map((game) => (
                    <div key={game.id} className="relative flex items-center">
                      <Matchup
                        game={game}
                        poolTeams={poolTeams}
                        entries={entries}
                        currentUserId={currentUserId}
                        highlightEntryId={highlightEntryId}
                        width={roundData.width}
                      />
                      {/* Connector line to next round */}
                      {roundIdx < rounds.length - 1 && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 w-3 h-px bg-border ${
                            flowDirection === "right" ? "-right-3" : "-left-3"
                          }`}
                        />
                      )}
                    </div>
                  ))
                : // Placeholder slots when no games exist yet
                  Array.from({ length: numGames }).map((_, idx) => (
                    <div key={idx} className="relative flex items-center">
                      <Matchup
                        game={null}
                        poolTeams={poolTeams}
                        entries={entries}
                        currentUserId={currentUserId}
                        highlightEntryId={highlightEntryId}
                        width={roundData.width}
                      />
                    </div>
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Final Four component
interface FinalFourProps {
  games: MmGame[];
  poolTeams: MmPoolTeam[];
  entries: MmEntry[];
  currentUserId: string | null;
  highlightEntryId: string | null;
}

function FinalFour({
  games,
  poolTeams,
  entries,
  currentUserId,
  highlightEntryId,
}: FinalFourProps) {
  const f4Games = games
    .filter((g) => g.round === "F4")
    .sort((a, b) => (a.game_number || 0) - (b.game_number || 0));
  const finalGame = games.find((g) => g.round === "Final");

  // Find the champion entry
  const championEntry = finalGame?.advancing_entry_id
    ? entries.find((e) => e.id === finalGame.advancing_entry_id)
    : null;
  const championTeam = championEntry?.current_team_id
    ? poolTeams.find((t) => t.id === championEntry.current_team_id)
    : null;

  return (
    <Card className="bg-gradient-to-b from-amber-50 to-background border-amber-200 p-4">
      <div className="text-center mb-4">
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider">
          Final Four
        </Badge>
      </div>

      <div className="flex items-center justify-center gap-2">
        {/* Left semifinal */}
        <Matchup
          game={f4Games[0] || null}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
          width="w-[115px]"
        />

        {/* Championship */}
        <div className="flex flex-col items-center">
          <div className="text-center mb-1">
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-amber-700 border-amber-300 uppercase"
            >
              Championship
            </Badge>
          </div>
          <Matchup
            game={finalGame || null}
            poolTeams={poolTeams}
            entries={entries}
            currentUserId={currentUserId}
            highlightEntryId={highlightEntryId}
            width="w-[120px]"
          />
          {/* Champion display */}
          {championEntry && finalGame?.status === "final" && (
            <div className="mt-4 text-center">
              <Card className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300 px-4 py-2">
                <span className="text-2xl">🏆</span>
                <div className="text-left">
                  <div className="font-bold text-amber-800">
                    {championTeam?.bb_teams?.name || "Champion"}
                  </div>
                  <div className="text-sm text-amber-600">
                    {championEntry.display_name}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right semifinal */}
        <Matchup
          game={f4Games[1] || null}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
          width="w-[115px]"
        />
      </div>
    </Card>
  );
}

export function BracketView({
  games,
  entries,
  poolTeams,
  currentUserId,
}: BracketViewProps) {
  // State for highlighted entry (from search)
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  // Check if bracket is empty
  if (games.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No games scheduled yet. Set up teams and run the draw to generate the
          bracket.
        </p>
      </Card>
    );
  }

  // Group games by region
  const gamesByRegion = useMemo(() => {
    const map = new Map<Region, MmGame[]>();
    REGIONS.forEach((region) => {
      map.set(
        region,
        games.filter((g) => g.region === region)
      );
    });
    return map;
  }, [games]);

  return (
    <div className="space-y-4">
      {/* Search box for highlighting a participant's path */}
      <div className="flex items-center gap-3">
        <EntrySearch
          entries={entries}
          selectedEntryId={highlightEntryId}
          onSelect={setHighlightEntryId}
        />
        {highlightEntryId && (
          <span className="text-sm text-muted-foreground">
            Showing path for selected participant
          </span>
        )}
      </div>

      {/* Desktop bracket view - true bracket layout */}
      <div className="hidden xl:block overflow-x-auto">
        <div className="min-w-[1200px] px-2">
          {/* Top half: East (left→) and South (←right) */}
          <div className="flex justify-center gap-4 items-start mb-4">
            <RegionColumn
              region="East"
              games={gamesByRegion.get("East") || []}
              poolTeams={poolTeams}
              entries={entries}
              currentUserId={currentUserId}
              highlightEntryId={highlightEntryId}
              flowDirection="right"
            />
            <RegionColumn
              region="South"
              games={gamesByRegion.get("South") || []}
              poolTeams={poolTeams}
              entries={entries}
              currentUserId={currentUserId}
              highlightEntryId={highlightEntryId}
              flowDirection="left"
            />
          </div>

          {/* Final Four in center */}
          <div className="flex justify-center my-4">
            <FinalFour
              games={games}
              poolTeams={poolTeams}
              entries={entries}
              currentUserId={currentUserId}
              highlightEntryId={highlightEntryId}
            />
          </div>

          {/* Bottom half: West (left→) and Midwest (←right) */}
          <div className="flex justify-center gap-4 items-end mt-4">
            <RegionColumn
              region="West"
              games={gamesByRegion.get("West") || []}
              poolTeams={poolTeams}
              entries={entries}
              currentUserId={currentUserId}
              highlightEntryId={highlightEntryId}
              flowDirection="right"
            />
            <RegionColumn
              region="Midwest"
              games={gamesByRegion.get("Midwest") || []}
              poolTeams={poolTeams}
              entries={entries}
              currentUserId={currentUserId}
              highlightEntryId={highlightEntryId}
              flowDirection="left"
            />
          </div>
        </div>
      </div>

      {/* Tablet/Mobile view - stacked by round */}
      <div className="xl:hidden space-y-6">
        <MobileRoundView
          round="R64"
          label="Round of 64"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
        <MobileRoundView
          round="R32"
          label="Round of 32"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
        <MobileRoundView
          round="S16"
          label="Sweet 16"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
        <MobileRoundView
          round="E8"
          label="Elite 8"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
        <MobileRoundView
          round="F4"
          label="Final Four"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
        <MobileRoundView
          round="Final"
          label="Championship"
          games={games}
          poolTeams={poolTeams}
          entries={entries}
          currentUserId={currentUserId}
          highlightEntryId={highlightEntryId}
        />
      </div>

      {/* Legend */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-[3px] ring-sky-500 ring-offset-1 shadow-[0_0_8px_rgba(14,165,233,0.5)] bg-white border border-border" />
            <span>Highlighted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-l-2 border-l-emerald-500 bg-emerald-50 border border-border" />
            <span>Won + covered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-l-2 border-l-amber-500 bg-amber-50 border border-border" />
            <span>Spread upset</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted/50 border border-border opacity-60" />
            <span>Eliminated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-2 ring-amber-400 ring-offset-1 bg-white border border-border" />
            <span>Live</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Mobile round view component
interface MobileRoundViewProps {
  round: string;
  label: string;
  games: MmGame[];
  poolTeams: MmPoolTeam[];
  entries: MmEntry[];
  currentUserId: string | null;
  highlightEntryId: string | null;
}

function MobileRoundView({
  round,
  label,
  games,
  poolTeams,
  entries,
  currentUserId,
  highlightEntryId,
}: MobileRoundViewProps) {
  const roundGames = games
    .filter((g) => g.round === round)
    .sort((a, b) => {
      // Sort by region, then game number
      const regionOrder = ["East", "West", "South", "Midwest"];
      const aRegion = regionOrder.indexOf(a.region || "");
      const bRegion = regionOrder.indexOf(b.region || "");
      if (aRegion !== bRegion) return aRegion - bRegion;
      return (a.game_number || 0) - (b.game_number || 0);
    });

  if (roundGames.length === 0) return null;

  const completedCount = roundGames.filter((g) => g.status === "final").length;

  // Group by region for better organization
  const byRegion = REGIONS.map((region) => ({
    region,
    games: roundGames.filter((g) => g.region === region),
  })).filter((r) => r.games.length > 0);

  // For Final Four and Championship, don't group by region
  const isFinalRounds = round === "F4" || round === "Final";

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          {label}
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{roundGames.length}
          </Badge>
        </h3>

        {isFinalRounds ? (
          <div
            className={`flex flex-wrap justify-center gap-3 ${
              round === "Final" ? "max-w-xs mx-auto" : ""
            }`}
          >
            {roundGames.map((game) => (
              <Matchup
                key={game.id}
                game={game}
                poolTeams={poolTeams}
                entries={entries}
                currentUserId={currentUserId}
                highlightEntryId={highlightEntryId}
                width="w-40"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {byRegion.map(({ region, games: regionGames }) => (
              <div key={region}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {region} Region
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {regionGames.map((game) => (
                    <Matchup
                      key={game.id}
                      game={game}
                      poolTeams={poolTeams}
                      entries={entries}
                      currentUserId={currentUserId}
                      highlightEntryId={highlightEntryId}
                      width="w-full"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
