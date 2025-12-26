import * as React from "react"
import { Button } from "./ui/button"
import { TimePicker } from "./ui/time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { X, Plus, Copy, MoreHorizontal } from "lucide-react"
import { cn } from "../lib/utils"

// Standardized internal format - always use array format
export interface OpeningHoursSlot {
  day: string
  hours: {
    open: string  // "HH:MM" 24-hour format
    close: string // "HH:MM" 24-hour format
  }
}

interface OpeningHoursEditorProps {
  value: OpeningHoursSlot[] | Record<string, { open: string; close: string }> | null
  onChange: (value: OpeningHoursSlot[]) => void
  isEditing?: boolean
  className?: string
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DEFAULT_HOURS = { open: '09:00', close: '17:00' }

// Convert any format to standardized array format
function normalizeToArrayFormat(
  input: OpeningHoursSlot[] | Record<string, { open: string; close: string }> | null
): OpeningHoursSlot[] {
  if (!input) return []

  // Already array format
  if (Array.isArray(input)) {
    return input.map(slot => ({
      day: slot.day,
      hours: {
        open: slot.hours?.open || '',
        close: slot.hours?.close || ''
      }
    }))
  }

  // Object format - convert to array
  if (typeof input === 'object') {
    const result: OpeningHoursSlot[] = []
    Object.keys(input).forEach(day => {
      if (input[day]) {
        result.push({
          day,
          hours: {
            open: input[day].open || '',
            close: input[day].close || ''
          }
        })
      }
    })
    return result
  }

  return []
}

// Group slots by day for easier rendering
function groupByDay(slots: OpeningHoursSlot[]): Record<string, OpeningHoursSlot[]> {
  const grouped: Record<string, OpeningHoursSlot[]> = {}
  slots.forEach((slot, index) => {
    if (!grouped[slot.day]) {
      grouped[slot.day] = []
    }
    grouped[slot.day].push({ ...slot, index } as OpeningHoursSlot & { index: number })
  })
  return grouped
}

// Format time for display (remains 24-hour but formatted nicely)
function formatTimeDisplay(time: string): string {
  if (!time) return '--:--'
  const [h, m] = time.split(':')
  return `${h.padStart(2, '0')}:${m?.padStart(2, '0') || '00'}`
}

export function OpeningHoursEditor({
  value,
  onChange,
  isEditing = false,
  className
}: OpeningHoursEditorProps) {
  // Always work with normalized array format internally
  const normalizedValue = React.useMemo(() => normalizeToArrayFormat(value), [value])
  const groupedByDay = React.useMemo(() => groupByDay(normalizedValue), [normalizedValue])

  // Add a new time slot for a day
  const handleAddSlot = (day: string) => {
    const newSlot: OpeningHoursSlot = {
      day,
      hours: { ...DEFAULT_HOURS }
    }
    onChange([...normalizedValue, newSlot])
  }

  // Update a specific slot
  const handleUpdateSlot = (day: string, slotIndex: number, field: 'open' | 'close', value: string) => {
    const updated = normalizedValue.map((slot, idx) => {
      // Find matching slot by day and relative index within that day
      const daySlots = normalizedValue.filter(s => s.day === day)
      const matchingSlotGlobalIndex = normalizedValue.findIndex((s, i) => {
        if (s.day !== day) return false
        const daySlotIndex = normalizedValue.slice(0, i + 1).filter(x => x.day === day).length - 1
        return daySlotIndex === slotIndex
      })

      if (idx === matchingSlotGlobalIndex) {
        return {
          ...slot,
          hours: {
            ...slot.hours,
            [field]: value
          }
        }
      }
      return slot
    })
    onChange(updated)
  }

  // Remove a specific slot
  const handleRemoveSlot = (day: string, slotIndex: number) => {
    let daySlotCount = 0
    const updated = normalizedValue.filter((slot, idx) => {
      if (slot.day === day) {
        const shouldRemove = daySlotCount === slotIndex
        daySlotCount++
        return !shouldRemove
      }
      return true
    })
    onChange(updated)
  }

  // Delete all slots for a day
  const handleDeleteDay = (day: string) => {
    const updated = normalizedValue.filter(slot => slot.day !== day)
    onChange(updated)
  }

  // Copy hours from one day to another
  const handleCopyFromDay = (targetDay: string, sourceDay: string) => {
    const sourceSlots = groupedByDay[sourceDay] || []
    if (sourceSlots.length === 0) return

    // Remove existing slots for target day
    const filtered = normalizedValue.filter(slot => slot.day !== targetDay)

    // Add copied slots with target day
    const copiedSlots = sourceSlots.map(slot => ({
      day: targetDay,
      hours: { ...slot.hours }
    }))

    onChange([...filtered, ...copiedSlots])
  }

  // Get days that have hours set (for "Same as X" feature)
  const daysWithHours = React.useMemo(() => {
    return DAYS_OF_WEEK.filter(day => (groupedByDay[day]?.length || 0) > 0)
  }, [groupedByDay])

  return (
    <div className={cn("space-y-3", className)}>
      {DAYS_OF_WEEK.map(day => {
        const daySlots = groupedByDay[day] || []
        const hasSlotsSet = daySlots.length > 0

        return (
          <div key={day} className="flex items-start gap-4">
            {/* Day label */}
            <span className="text-sm font-medium w-24 pt-2 flex-shrink-0">
              {day}
            </span>

            {/* Time slots or actions */}
            <div className="flex-1 space-y-2">
              {!hasSlotsSet ? (
                // No hours set for this day
                isEditing ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSlot(day)}
                      className="h-9"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Hours
                    </Button>

                    {/* "Same as X day" dropdown */}
                    {daysWithHours.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9">
                            <Copy className="h-4 w-4 mr-1" />
                            Same as...
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {daysWithHours.map(sourceDay => (
                            <DropdownMenuItem
                              key={sourceDay}
                              onClick={() => handleCopyFromDay(day, sourceDay)}
                            >
                              {sourceDay}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground inline-block pt-2">
                    Closed
                  </span>
                )
              ) : (
                // Has hours - show time slots
                <>
                  {daySlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <TimePicker
                            value={slot.hours.open}
                            onChange={(val) => handleUpdateSlot(day, slotIndex, 'open', val)}
                          />
                          <span className="text-muted-foreground">-</span>
                          <TimePicker
                            value={slot.hours.close}
                            onChange={(val) => handleUpdateSlot(day, slotIndex, 'close', val)}
                          />
                          {daySlots.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveSlot(day, slotIndex)}
                              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm">
                          {formatTimeDisplay(slot.hours.open)} - {formatTimeDisplay(slot.hours.close)}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Action buttons when editing */}
                  {isEditing && (
                    <div className="flex items-center gap-2 pt-1">
                      {daySlots.length < 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddSlot(day)}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add slot
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {/* Copy to other days */}
                          {daysWithHours.filter(d => d !== day).map(sourceDay => (
                            <DropdownMenuItem
                              key={`copy-${sourceDay}`}
                              onClick={() => handleCopyFromDay(day, sourceDay)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Same as {sourceDay}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => handleDeleteDay(day)}
                            className="text-destructive focus:text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Mark as Closed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default OpeningHoursEditor
