"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, STATUS_DOT_COLORS } from "@/lib/constants";

export function StatusMultiSelect() {
  const [eventStatus, setEventStatus] = useQueryState(
    "eventStatus",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false })
  );

  const selectedStatuses = eventStatus ? eventStatus.split(",").filter(Boolean) : [];

  const toggle = (status: string) => {
    let next: string[];
    if (selectedStatuses.includes(status)) {
      next = selectedStatuses.filter((s) => s !== status);
    } else {
      next = [...selectedStatuses, status];
    }
    setEventStatus(next.length > 0 ? next.join(",") : null);
    setPage(1);
  };

  const selectAll = () => {
    setEventStatus(null);
    setPage(1);
  };

  const selectNone = () => {
    // Selecting none is equivalent to clearing — show all
    setEventStatus(null);
    setPage(1);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground"
          onClick={selectAll}
        >
          All
        </Button>
        <span className="text-muted-foreground text-xs">/</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground"
          onClick={selectNone}
        >
          None
        </Button>
      </div>
      <div className="space-y-1.5">
        {EVENT_STATUSES.map((status) => {
          const dotColor = STATUS_DOT_COLORS[status];
          const checked = selectedStatuses.includes(status);
          return (
            <label
              key={status}
              className="flex items-center gap-2 cursor-pointer py-0.5 hover:bg-muted/50 rounded px-1 -mx-1"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(status)}
              />
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              <span className="text-xs">{status.replace("_", " ")}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
