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
import { EVENT_STATUSES } from "@/lib/constants";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

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

  const hasFilters = processName || batchId || accountId || eventStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Process name..."
        value={localProcessName}
        onChange={(e) => setLocalProcessName(e.target.value)}
        className="w-48"
      />
      <Input
        placeholder="Batch ID..."
        value={localBatchId}
        onChange={(e) => setLocalBatchId(e.target.value)}
        className="w-44"
      />
      <Input
        placeholder="Account ID..."
        value={localAccountId}
        onChange={(e) => setLocalAccountId(e.target.value)}
        className="w-40"
      />
      <Select value={eventStatus || "ALL"} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          {EVENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
