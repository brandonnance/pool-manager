"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExistingSquare {
  row_index: number;
  col_index: number;
  participant_name: string | null;
}

export interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sqPoolId: string;
  existingSquares: ExistingSquare[];
  onComplete: () => void;
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  sqPoolId,
  existingSquares,
  onComplete,
}: BulkAssignDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [verified, setVerified] = useState(false);
  const [selectedSquares, setSelectedSquares] = useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build set of claimed squares
  const claimedSquares = useMemo(() => {
    const set = new Set<string>();
    existingSquares.forEach((sq) => {
      if (sq.participant_name) {
        set.add(`${sq.row_index}-${sq.col_index}`);
      }
    });
    return set;
  }, [existingSquares]);

  // Fetch existing participant names for autocomplete and case normalization
  useEffect(() => {
    if (open) {
      const fetchNames = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("sq_squares")
          .select("participant_name")
          .eq("sq_pool_id", sqPoolId)
          .not("participant_name", "is", null);

        if (data) {
          // Get unique names (case-insensitive), preserving first occurrence casing
          const nameMap = new Map<string, string>();
          data.forEach((s) => {
            if (s.participant_name) {
              const lowerName = s.participant_name.toLowerCase();
              if (!nameMap.has(lowerName)) {
                nameMap.set(lowerName, s.participant_name);
              }
            }
          });
          const uniqueNames = Array.from(nameMap.values());
          uniqueNames.sort((a, b) => a.localeCompare(b));
          setExistingNames(uniqueNames);
        }
      };
      fetchNames();
    }
  }, [open, sqPoolId]);

  // Filter suggestions based on input
  const filteredSuggestions = name.trim()
    ? existingNames.filter(
        (n) =>
          n.toLowerCase().includes(name.toLowerCase()) &&
          n.toLowerCase() !== name.toLowerCase()
      )
    : [];

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || filteredSuggestions.length === 0) {
        if (e.key === "ArrowDown" && filteredSuggestions.length > 0) {
          setShowSuggestions(true);
          setSelectedIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          if (
            selectedIndex >= 0 &&
            selectedIndex < filteredSuggestions.length
          ) {
            e.preventDefault();
            setName(filteredSuggestions[selectedIndex]);
            setShowSuggestions(false);
            setSelectedIndex(-1);
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [showSuggestions, filteredSuggestions, selectedIndex]
  );

  const handleSelectSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Find the canonical (first-used) casing for a name
  const getCanonicalName = (inputName: string): string => {
    const lowerInput = inputName.toLowerCase();
    const existingMatch = existingNames.find(
      (n) => n.toLowerCase() === lowerInput
    );
    return existingMatch ?? inputName;
  };

  // Reset form when dialog opens (via prop change)
  useEffect(() => {
    if (open) {
      setName("");
      setVerified(false);
      setSelectedSquares(new Set());
      setError(null);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [open]);

  // Handle dialog close
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const toggleSquare = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    if (claimedSquares.has(key)) return; // Can't select claimed squares

    setSelectedSquares((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allAvailable = new Set<string>();
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const key = `${row}-${col}`;
        if (!claimedSquares.has(key)) {
          allAvailable.add(key);
        }
      }
    }
    setSelectedSquares(allAvailable);
  };

  const clearSelection = () => {
    setSelectedSquares(new Set());
  };

  const handleAssign = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name");
      return;
    }
    if (selectedSquares.size === 0) {
      setError("Please select at least one square");
      return;
    }

    // Normalize to existing casing if a case-insensitive match exists
    const normalizedName = getCanonicalName(trimmedName);

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();

    // Build insert array
    const inserts = Array.from(selectedSquares).map((key) => {
      const [row, col] = key.split("-").map(Number);
      return {
        sq_pool_id: sqPoolId,
        row_index: row,
        col_index: col,
        participant_name: normalizedName,
        verified,
      };
    });

    const { error: insertError } = await supabase
      .from("sq_squares")
      .insert(inserts);

    if (insertError) {
      if (insertError.code === "23505") {
        setError(
          "Some squares were just claimed. Please refresh and try again."
        );
      } else {
        setError(insertError.message);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    handleOpenChange(false);
    onComplete();
    router.refresh();
  };

  const availableCount = 100 - claimedSquares.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Assign Squares</DialogTitle>
          <DialogDescription>
            Select multiple available squares to assign to one person
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-name">Participant Name</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="bulk-name"
                placeholder="e.g., John Smith or Team Alpha"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                  setSelectedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => name.trim() && setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                disabled={isSubmitting}
                autoComplete="off"
              />
              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                        index === selectedIndex && "bg-gray-100"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {existingNames.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Suggestions will appear as you type
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="bulk-verified">Verified</Label>
              <p className="text-xs text-muted-foreground">
                Mark all selected squares as verified
              </p>
            </div>
            <Switch
              id="bulk-verified"
              checked={verified}
              onCheckedChange={setVerified}
              disabled={isSubmitting}
            />
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedSquares.size} selected</Badge>
              <Badge variant="outline">{availableCount} available</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={isSubmitting}
              >
                Select All Available
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={isSubmitting || selectedSquares.size === 0}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Mini grid for selection */}
          <div className="border rounded-lg p-2 bg-muted/30">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: "repeat(10, 1fr)",
              }}
            >
              {Array.from({ length: 100 }, (_, i) => {
                const row = Math.floor(i / 10);
                const col = i % 10;
                const key = `${row}-${col}`;
                const isClaimed = claimedSquares.has(key);
                const isSelected = selectedSquares.has(key);
                const gridNumber = `${row}${col}`;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSquare(row, col)}
                    disabled={isClaimed || isSubmitting}
                    className={cn(
                      "aspect-square text-[10px] font-medium rounded border transition-colors",
                      isClaimed
                        ? "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
                        : isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
                    )}
                    title={
                      isClaimed
                        ? `Square ${gridNumber} - Already claimed`
                        : isSelected
                        ? `Square ${gridNumber} - Selected (click to deselect)`
                        : `Square ${gridNumber} - Click to select`
                    }
                  >
                    {gridNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Click squares to select/deselect. Gray squares are already claimed.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              isSubmitting || !name.trim() || selectedSquares.size === 0
            }
          >
            {isSubmitting
              ? "Assigning..."
              : `Assign ${selectedSquares.size} Square${
                  selectedSquares.size !== 1 ? "s" : ""
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
