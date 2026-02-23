# Pagination Benchmark

This folder stores benchmark outputs for the current public API query paths.

Benchmarks are split into two suites:

- `core`: pagination-heavy endpoints used by dashboard/agent lookups
- `search`: constrained text-search scenarios (including date windows)

## Commands

Run from `api/`:

```bash
pnpm run bench:seed
pnpm run bench:pagination-core
pnpm run bench:search
```

By default, benchmark page sizes are endpoint-specific:

- `by-account`: `10,50,100` (route max `100`)
- `by-batch`: `10,50,100` (route max `100`)
- `by-correlation`: `10,50,200` (route max `500`)
- `by-trace`: `10,50,200` (route max `500`)
- `lookup`: `10,50,100` (route max `100`)
- `search`: `10,25,50` (route max `50`)

Override examples:

```bash
pnpm run bench:pagination-core -- --pageSizesByAccount=10,25,100 --pageSizesLookup=10,25,100
pnpm run bench:search -- --pageSizesBySearch=10,25,50
```

Or apply one list to all endpoints:

```bash
pnpm run bench:pagination-core -- --pageSizes=10,50
```

Combined:

```bash
pnpm run bench:all
```

## Outputs

Benchmark results are written to `api/benchmarks/results/`:

- `<timestamp>.json` - machine-readable raw metrics and correctness checks
- `<timestamp>.md` - summary table for quick review

## Notes

- Seed is top-up only by default (no destructive reset).
- Benchmark assumes API is already running on `http://localhost:3000`.
- Scripts expect local SQL-auth MSSQL env vars: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Known tradeoff: out-of-range pagination can be slower on `COUNT(*) OVER()` paths. Core suite reports this explicitly with an absolute-latency gate.
