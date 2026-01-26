"use client";

import { useQueryState, parseAsInteger } from "nuqs";
import { Button } from "@/components/ui/button";

interface TracePaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
}

export function TracePagination({ page, totalPages, totalCount }: TracePaginationProps) {
  const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  if (totalPages <= 1) {
    return (
      <div className="text-sm text-muted-foreground">
        {totalCount} trace{totalCount !== 1 ? "s" : ""}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({totalCount} traces)
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
