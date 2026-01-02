import * as React from "react"
import { Input } from "./input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { cn } from "../../lib/utils"
import { ChevronDown } from "lucide-react"

interface TimePickerProps {
  value: string // Format: "HH:MM" (24-hour)
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

// Generate hours 00-23
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0')
)

// Generate minutes in 15-minute increments: 00, 15, 30, 45, plus 59 for end-of-hour
const MINUTES = ['00', '15', '30', '45', '59']

export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
}: TimePickerProps) {
  const [hoursOpen, setHoursOpen] = React.useState(false)
  const [minutesOpen, setMinutesOpen] = React.useState(false)

  // Local state for typing - allows incomplete values during editing
  const [localHours, setLocalHours] = React.useState<string | null>(null)
  const [localMinutes, setLocalMinutes] = React.useState<string | null>(null)

  // Parse current value from props (only used when not actively editing)
  const [parsedHours, parsedMinutes] = React.useMemo(() => {
    if (!value) return ['', '']
    const parts = value.split(':')
    if (parts.length !== 2) return ['', '']
    return [parts[0].padStart(2, '0'), parts[1].padStart(2, '0')]
  }, [value])

  // Display values: use local state while editing, otherwise use parsed props
  const displayHours = localHours !== null ? localHours : parsedHours
  const displayMinutes = localMinutes !== null ? localMinutes : parsedMinutes

  const handleHourChange = (newHour: string) => {
    // Allow only digits and limit to 2 characters
    const sanitized = newHour.replace(/\D/g, '').slice(0, 2)
    setLocalHours(sanitized)
  }

  const handleHourBlur = () => {
    // Validate, clamp, and commit hour value on blur
    const hourValue = localHours !== null ? localHours : parsedHours
    let hourNum = parseInt(hourValue) || 0
    if (hourNum > 23) hourNum = 23
    if (hourNum < 0) hourNum = 0
    const finalHour = hourNum.toString().padStart(2, '0')
    const finalMinutes = parsedMinutes || '00'
    onChange(`${finalHour}:${finalMinutes}`)
    setLocalHours(null) // Clear local state, use props again
  }

  const handleMinuteChange = (newMinute: string) => {
    // Allow only digits and limit to 2 characters
    const sanitized = newMinute.replace(/\D/g, '').slice(0, 2)
    setLocalMinutes(sanitized)
  }

  const handleMinuteBlur = () => {
    // Validate, clamp, and commit minute value on blur
    const minuteValue = localMinutes !== null ? localMinutes : parsedMinutes
    let minuteNum = parseInt(minuteValue) || 0
    if (minuteNum > 59) minuteNum = 59
    if (minuteNum < 0) minuteNum = 0
    const finalMinute = minuteNum.toString().padStart(2, '0')
    const finalHours = parsedHours || '00'
    onChange(`${finalHours}:${finalMinute}`)
    setLocalMinutes(null) // Clear local state, use props again
  }

  const selectHour = (h: string) => {
    const finalMinutes = parsedMinutes || '00'
    onChange(`${h}:${finalMinutes}`)
    setLocalHours(null)
    setHoursOpen(false)
  }

  const selectMinute = (m: string) => {
    const finalHours = parsedHours || '00'
    onChange(`${finalHours}:${m}`)
    setLocalMinutes(null)
    setMinutesOpen(false)
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Hours input with dropdown */}
      <Popover open={hoursOpen} onOpenChange={setHoursOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={displayHours}
              onChange={(e) => handleHourChange(e.target.value)}
              onBlur={handleHourBlur}
              disabled={disabled}
              className="w-[60px] h-9 pr-6 text-center"
              placeholder="HH"
            />
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50 cursor-pointer"
              onClick={() => !disabled && setHoursOpen(true)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[140px] p-1" align="start">
          <div className="flex gap-2">
            {/* AM hours (00-11) */}
            <div className="flex-1">
              <div className="text-xs text-muted-foreground text-center mb-1">AM</div>
              <div className="grid grid-cols-1 gap-0.5">
                {HOURS.slice(0, 12).map((h) => (
                  <button
                    key={h}
                    onClick={() => selectHour(h)}
                    className={cn(
                      "px-2 py-1 text-sm rounded hover:bg-accent text-center",
                      parsedHours === h && "bg-accent font-medium"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            {/* PM hours (12-23) */}
            <div className="flex-1">
              <div className="text-xs text-muted-foreground text-center mb-1">PM</div>
              <div className="grid grid-cols-1 gap-0.5">
                {HOURS.slice(12, 24).map((h) => (
                  <button
                    key={h}
                    onClick={() => selectHour(h)}
                    className={cn(
                      "px-2 py-1 text-sm rounded hover:bg-accent text-center",
                      parsedHours === h && "bg-accent font-medium"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground font-medium">:</span>

      {/* Minutes input with dropdown */}
      <Popover open={minutesOpen} onOpenChange={setMinutesOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={displayMinutes}
              onChange={(e) => handleMinuteChange(e.target.value)}
              onBlur={handleMinuteBlur}
              disabled={disabled}
              className="w-[60px] h-9 pr-6 text-center"
              placeholder="MM"
            />
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50 cursor-pointer"
              onClick={() => !disabled && setMinutesOpen(true)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[80px] p-1" align="start">
          <div className="grid grid-cols-1 gap-0.5">
            {MINUTES.map((m) => (
              <button
                key={m}
                onClick={() => selectMinute(m)}
                className={cn(
                  "px-2 py-1 text-sm rounded hover:bg-accent text-center",
                  parsedMinutes === m && "bg-accent font-medium"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { TimePicker as default }
