"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EVENT_STATUSES, STATUS_ICONS } from "@/lib/constants";
import { Filter, Workflow, Hash, User, X, CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const STATUS_DISPLAY: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  SUCCESS: { icon: CheckCircle2, color: "text-green-500" },
  FAILURE: { icon: XCircle, color: "text-red-500" },
  IN_PROGRESS: { icon: Clock, color: "text-yellow-500" },
  SKIPPED: { icon: MinusCircle, color: "text-gray-400" },
};

export function TraceFilters() {
  const [processName, setProcessName] = useQueryState(
    "processName",
    parseAsString.withDefault("")
  );
  const [batchId, setBatchId] = useQueryState(
    "batchId",
    parseAsString.withDefault("")
  );
  const [accountId, setAccountId] = useQueryState(
    "accountId",
    parseAsString.withDefault("")
  );
  const [eventStatus, setEventStatus] = useQueryState(
    "eventStatus",
    parseAsString.withDefault("")
  );
  const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  // Local state for debounced inputs
  const [localProcessName, setLocalProcessName] = useState(processName);
  const [localBatchId, setLocalBatchId] = useState(batchId);
  const [localAccountId, setLocalAccountId] = useState(accountId);

  const debouncedProcessName = useDebounce(localProcessName, 300);
  const debouncedBatchId = useDebounce(localBatchId, 300);
  const debouncedAccountId = useDebounce(localAccountId, 300);

  useEffect(() => {
    if (debouncedProcessName !== processName) {
      setProcessName(debouncedProcessName || null);
      setPage(1);
    }
  }, [debouncedProcessName, processName, setProcessName, setPage]);

  useEffect(() => {
    if (debouncedBatchId !== batchId) {
      setBatchId(debouncedBatchId || null);
      setPage(1);
    }
  }, [debouncedBatchId, batchId, setBatchId, setPage]);

  useEffect(() => {
    if (debouncedAccountId !== accountId) {
      setAccountId(debouncedAccountId || null);
      setPage(1);
    }
  }, [debouncedAccountId, accountId, setAccountId, setPage]);

  const handleStatusChange = (value: string) => {
    setEventStatus(value === "ALL" ? null : value);
    setPage(1);
  };

  const handleClear = () => {
    setLocalProcessName("");
    setLocalBatchId("");
    setLocalAccountId("");
    setProcessName(null);
    setBatchId(null);
    setAccountId(null);
    setEventStatus(null);
    setPage(1);
  };

  // Count active filters
  const activeFilters = [processName, batchId, accountId, eventStatus].filter(Boolean).length;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm">Filters</span>
            {activeFilters > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilters} active
              </Badge>
            )}
          </div>
          {activeFilters > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* Filter inputs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Workflow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Process name..."
              value={localProcessName}
              onChange={(e) => setLocalProcessName(e.target.value)}
              className="w-48 pl-9"
            />
          </div>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Batch ID..."
              value={localBatchId}
              onChange={(e) => setLocalBatchId(e.target.value)}
              className="w-44 pl-9"
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Account ID..."
              value={localAccountId}
              onChange={(e) => setLocalAccountId(e.target.value)}
              className="w-44 pl-9"
            />
          </div>
          <Select value={eventStatus || "ALL"} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {EVENT_STATUSES.map((status) => {
                const { icon: Icon, color } = STATUS_DISPLAY[status] ?? { icon: MinusCircle, color: "text-gray-400" };
                return (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span>{status}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
