import React, { useState } from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(value || undefined);
  const [tempTime, setTempTime] = useState({
    hours: value ? value.getHours() : 9,
    minutes: value ? value.getMinutes() : 0,
  });

  const handleDateSelect = (date: Date | undefined) => {
    setTempDate(date);
  };

  const handleConfirm = () => {
    if (tempDate) {
      const newDate = new Date(tempDate);
      newDate.setHours(tempTime.hours);
      newDate.setMinutes(tempTime.minutes);
      onChange(newDate);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setTempDate(value || undefined);
    setTempTime({
      hours: value ? value.getHours() : 9,
      minutes: value ? value.getMinutes() : 0,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setTempDate(undefined);
    setTempTime({ hours: 9, minutes: 0 });
    setIsOpen(false);
  };

  // Generate hour options (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Generate minute options (0-59)
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, 'dd/MM/yyyy HH:mm')
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          <div className="flex gap-4">
            {/* Calendar on the left */}
            <div>
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </div>

            {/* Time picker on the right */}
            <div className="flex flex-col justify-between border-l pl-4 min-w-[160px]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Time</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      setTempTime({
                        hours: now.getHours(),
                        minutes: now.getMinutes()
                      });
                    }}
                  >
                    Now
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={tempTime.hours.toString()}
                    onValueChange={(v) => setTempTime({ ...tempTime, hours: parseInt(v) })}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map((hour) => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-lg font-medium">:</span>

                  <Select
                    value={tempTime.minutes.toString()}
                    onValueChange={(v) => setTempTime({ ...tempTime, minutes: parseInt(v) })}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minutes.map((minute) => (
                        <SelectItem key={minute} value={minute.toString()}>
                          {minute.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Buttons at the bottom of the right side */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={!tempDate}
                    className="flex-1"
                  >
                    Confirm
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="w-full"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
