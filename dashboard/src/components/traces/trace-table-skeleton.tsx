import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TraceTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trace ID</TableHead>
            <TableHead>Process Name</TableHead>
            <TableHead>Account ID</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Last Event</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-14" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
