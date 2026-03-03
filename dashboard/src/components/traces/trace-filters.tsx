"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Filter,
  Workflow,
  User,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  Fingerprint,
  Link2,
} from "lucide-react";
import { DateRangePicker } from "./date-range-picker";
import { StatusMultiSelect } from "./status-multi-select";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function TraceFilters({ children }: { children: React.ReactNode }) {
  const [processName, setProcessName] = useQueryState(
    "processName",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [accountId, setAccountId] = useQueryState(
    "accountId",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [traceId, setTraceId] = useQueryState(
    "traceId",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [correlationId, setCorrelationId] = useQueryState(
    "correlationId",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [eventStatus, setEventStatus] = useQueryState(
    "eventStatus",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [hasErrors, setHasErrors] = useQueryState(
    "hasErrors",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
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

  // Local state for debounced text inputs
  const [localProcessName, setLocalProcessName] = useState(processName);
  const [localAccountId, setLocalAccountId] = useState(accountId);
  const [localTraceId, setLocalTraceId] = useState(traceId);
  const [localCorrelationId, setLocalCorrelationId] = useState(correlationId);

  const debouncedProcessName = useDebounce(localProcessName, 300);
  const debouncedAccountId = useDebounce(localAccountId, 300);
  const debouncedTraceId = useDebounce(localTraceId, 300);
  const debouncedCorrelationId = useDebounce(localCorrelationId, 300);

  useEffect(() => {
    if (debouncedProcessName !== processName) {
      setProcessName(debouncedProcessName || null);
      setPage(1);
    }
  }, [debouncedProcessName, processName, setProcessName, setPage]);

  useEffect(() => {
    if (debouncedAccountId !== accountId) {
      setAccountId(debouncedAccountId || null);
      setPage(1);
    }
  }, [debouncedAccountId, accountId, setAccountId, setPage]);

  useEffect(() => {
    if (debouncedTraceId !== traceId) {
      setTraceId(debouncedTraceId || null);
      setPage(1);
    }
  }, [debouncedTraceId, traceId, setTraceId, setPage]);

  useEffect(() => {
    if (debouncedCorrelationId !== correlationId) {
      setCorrelationId(debouncedCorrelationId || null);
      setPage(1);
    }
  }, [debouncedCorrelationId, correlationId, setCorrelationId, setPage]);

  // Panel open/close
  const [panelOpen, setPanelOpen] = useState(true);

  const handleClearAll = () => {
    setLocalProcessName("");
    setLocalAccountId("");
    setLocalTraceId("");
    setLocalCorrelationId("");
    setProcessName(null);
    setAccountId(null);
    setTraceId(null);
    setCorrelationId(null);
    setEventStatus(null);
    setHasErrors(null);
    setStartDate(null);
    setEndDate(null);
    setPage(1);
  };

  // Count active filters
  const activeFilters = [
    processName,
    accountId,
    traceId,
    correlationId,
    eventStatus,
    hasErrors,
    startDate && endDate ? "dateRange" : "",
  ].filter(Boolean).length;

  const toggleErrors = () => {
    setHasErrors(hasErrors ? null : "true");
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar row */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          {panelOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Filters</span>
        </Button>
        {activeFilters > 0 && (
          <>
            <Badge variant="secondary" className="text-xs">
              {activeFilters} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          </>
        )}
      </div>

      {/* Side-by-side: filter panel + table */}
      <div className="flex flex-row gap-4 items-start">
        {panelOpen && (
          <div className="w-[280px] shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm">Filters</span>
              </div>

              <Accordion
                type="multiple"
                defaultValue={["time", "identifiers", "status"]}
                className="w-full"
              >
                {/* Time section */}
                <AccordionItem value="time">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3">
                    Time
                  </AccordionTrigger>
                  <AccordionContent>
                    <DateRangePicker />
                  </AccordionContent>
                </AccordionItem>

                {/* Identifiers section */}
                <AccordionItem value="identifiers">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3">
                    Identifiers
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Process Name</label>
                      <div className="relative">
                        <Workflow className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={localProcessName}
                          onChange={(e) => setLocalProcessName(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Account ID</label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={localAccountId}
                          onChange={(e) => setLocalAccountId(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Trace ID</label>
                      <div className="relative">
                        <Fingerprint className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Exact match..."
                          value={localTraceId}
                          onChange={(e) => setLocalTraceId(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Correlation ID</label>
                      <div className="relative">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Exact match..."
                          value={localCorrelationId}
                          onChange={(e) => setLocalCorrelationId(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Status section */}
                <AccordionItem value="status">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3">
                    Status
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <StatusMultiSelect />
                    <div className="border-t pt-3">
                      <Button
                        variant={hasErrors ? "destructive" : "outline"}
                        size="sm"
                        className="w-full gap-2 h-8 text-xs"
                        onClick={toggleErrors}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Errors Only
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}

        {/* Table content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
