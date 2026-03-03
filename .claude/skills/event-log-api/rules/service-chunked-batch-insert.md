---
title: Chunked Batch Insert
impact: HIGH
impactDescription: prevents timeout and memory issues on large batch inserts
tags: service, batch, chunking, transaction, fallback
---

## Chunked Batch Insert

Chunk large arrays, wrap in transaction, use per-chunk try/catch with individual fallback for failed chunks.

**Incorrect (single insert, no error isolation):**

```typescript
export async function createEvents(entries: EventLogEntry[]) {
  const db = await getDb();
  // Single insert with all rows — timeout on large batches, one bad row fails everything
  const results = await db.insert(eventLogs).output().values(entries.map(entryToInsert));
  return { executionIds: results.map(r => r.executionId), errors: [] };
}
```

**Correct (chunked with per-row fallback):**

```typescript
import { chunkArray } from '../utils/array';

const BATCH_CHUNK_SIZE = 100;

export async function createEvents(entries: EventLogEntry[], batchId?: string) {
  const db = await getDb();
  const executionIds: (string | null)[] = new Array(entries.length).fill(null);
  const errors: Array<{ index: number; error: string }> = [];

  await db.transaction(async (tx) => {
    const chunks = chunkArray(toInsert, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      try {
        const results = await tx.insert(eventLogs).output({...}).values(chunk.map(c => ...));
        results.forEach((row, i) => { executionIds[chunk[i].index] = row.executionId; });
      } catch {
        // Per-row fallback for failed chunk
        for (const item of chunk) {
          try {
            const [result] = await tx.insert(eventLogs).output({...}).values({...});
            executionIds[item.index] = result.executionId;
          } catch (err) {
            errors.push({ index: item.index, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }
      }
    }
  });

  return { executionIds: executionIds.filter((id): id is string => id !== null), errors };
}
```

The per-chunk fallback ensures one bad row doesn't fail the entire batch.
