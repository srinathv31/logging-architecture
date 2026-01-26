import { getTraces, type TraceListFilters } from "@/data/queries";
import { TraceTable } from "./trace-table";
import { TracePagination } from "./trace-pagination";

interface TraceTableServerProps {
  filters: TraceListFilters;
}

export async function TraceTableServer({ filters }: TraceTableServerProps) {
  const result = await getTraces(filters);

  return (
    <div className="space-y-4">
      <TraceTable data={result.traces} />
      <TracePagination
        page={result.page}
        totalPages={result.totalPages}
        totalCount={result.totalCount}
      />
    </div>
  );
}
