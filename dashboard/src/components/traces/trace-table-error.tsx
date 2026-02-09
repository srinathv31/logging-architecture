"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TraceTableError() {
  const router = useRouter();

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Trace</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Process</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Account</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Events</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Duration</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={7} className="h-48">
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Failed to load traces</p>
                  <p className="text-sm">Something went wrong while fetching trace data.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.refresh()}
                  className="mt-1"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Try again
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
