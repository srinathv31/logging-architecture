"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useState } from "react";
import { format, subHours, subDays, startOfWeek, startOfMonth, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Last Hour", getValue: () => ({ from: subHours(new Date(), 1), to: new Date() }) },
  { label: "Last 24 Hours", getValue: () => ({ from: subDays(new Date(), 1), to: new Date() }) },
  { label: "Last 7 Days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 Days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "This Week", getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
  { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
] as const;

export function DateRangePicker() {
  const [startDate, setStartDate] = useQueryState(
    "startDate",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [endDate, setEndDate] = useQueryState(
    "endDate",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false })
  );
  const [open, setOpen] = useState(false);

  const dateRange: DateRange | undefined =
    startDate && endDate
      ? { from: new Date(startDate), to: new Date(endDate) }
      : undefined;

  const applyRange = (from: Date, to: Date) => {
    setStartDate(startOfDay(from).toISOString());
    setEndDate(endOfDay(to).toISOString());
    setPage(1);
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      applyRange(range.from, range.to);
    } else if (range?.from) {
      // Partial selection — update local visual only via URL (single day)
      setStartDate(startOfDay(range.from).toISOString());
      setEndDate(endOfDay(range.from).toISOString());
      setPage(1);
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setPage(1);
    setOpen(false);
  };

  const displayLabel =
    startDate && endDate
      ? `${format(new Date(startDate), "MMM d")} – ${format(new Date(endDate), "MMM d")}`
      : "Pick a date range";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start text-left font-normal gap-2 h-9",
            !startDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="flex flex-col gap-1 border-r p-3 min-w-[140px]">
            <p className="text-xs font-medium text-muted-foreground mb-1">Quick select</p>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7"
                onClick={() => {
                  const { from, to } = preset.getValue();
                  applyRange(from, to);
                }}
              >
                {preset.label}
              </Button>
            ))}
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 text-muted-foreground mt-1"
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </div>
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
