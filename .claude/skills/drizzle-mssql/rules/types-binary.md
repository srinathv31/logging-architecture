---
title: MSSQL Binary Types
impact: LOW
impactDescription: proper handling of binary data like files and hashes
tags: mssql, binary, varbinary, blob, bytes
---

## MSSQL Binary Types

MSSQL provides binary types for storing raw byte data such as files, images, hashes, and encrypted data.

**Binary types overview:**

| Type | Length | Use Case |
|------|--------|----------|
| binary(n) | Fixed 1-8,000 bytes | Fixed-size data (hashes, GUIDs as bytes) |
| varbinary(n) | Variable 1-8,000 bytes | Variable-size small binary |
| varbinary(max) | Up to 2GB | Large files, images, documents |

**Incorrect (using string for binary data):**

```typescript
export const files = mssqlTable('files', {
  id: int('id').primaryKey(),
  // Wrong: storing binary as hex string wastes space
  hash: varchar('hash', { length: 64 }),  // SHA-256 as hex
  // Wrong: base64 encoding wastes ~33% more space
  thumbnail: nvarchar('thumbnail', { length: 'max' }),
});
```

**Correct (appropriate binary types):**

```typescript
import { mssqlTable, int, varchar, binary, varbinary } from 'drizzle-orm/mssql-core';

export const files = mssqlTable('files', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // binary(32) for SHA-256 hash (32 bytes)
  hash: binary('hash', { length: 32 }),
  // binary(16) for MD5 or UUID as bytes
  checksum: binary('checksum', { length: 16 }),
  // varbinary(max) for file content
  content: varbinary('content', { length: 'max' }),
  // varbinary for small variable binary (thumbnails, icons)
  thumbnail: varbinary('thumbnail', { length: 8000 }),
});
```

**Fixed vs variable binary:**

```typescript
export const security = mssqlTable('security', {
  id: int('id').primaryKey(),
  // Fixed size - all hashes are exactly 32 bytes
  sha256Hash: binary('sha256_hash', { length: 32 }),
  // Fixed size - AES keys are 16, 24, or 32 bytes
  encryptionKey: binary('encryption_key', { length: 32 }),
  // Variable size - encrypted data varies in length
  encryptedPayload: varbinary('encrypted_payload', { length: 'max' }),
  // Variable size - signatures can vary
  signature: varbinary('signature', { length: 512 }),
});
```

**Working with binary in application code:**

```typescript
import { sql } from 'drizzle-orm';

// Inserting binary data
const hash = crypto.createHash('sha256').update('data').digest();
await db.insert(files).values({
  name: 'document.pdf',
  hash: hash,  // Buffer/Uint8Array
  content: fileBuffer,
});

// Comparing binary values
const result = await db
  .select()
  .from(files)
  .where(sql`${files.hash} = ${hash}`);
```

**Guidelines:**
- Use `binary(n)` for fixed-size data (hashes, encryption keys)
- Use `varbinary(n)` for variable-size data up to 8KB
- Use `varbinary(max)` for large binary data (files, images)
- Store binary data directly - don't encode to hex/base64 in the database
- Consider storing large files in blob storage with only references in the database
