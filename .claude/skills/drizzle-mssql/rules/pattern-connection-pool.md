---
title: MSSQL Connection Pool Setup
impact: HIGH
impactDescription: ensures proper async connection handling and pool management
tags: mssql, connection, pool, async, setup
---

## MSSQL Connection Pool Setup

The node-mssql driver requires async initialization. Drizzle ORM with MSSQL needs proper connection pool setup to avoid runtime errors.

**Incorrect (missing await):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';

// Wrong: Pool not awaited before use
const pool = mssql.connect(connectionString);
const db = drizzle({ client: pool });  // pool is a Promise, not a ConnectionPool!

// This will fail at runtime
await db.select().from(users);
```

**Correct (basic setup):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';

// Simplest approach: pass connection string directly
const db = drizzle(process.env.DATABASE_URL!);

// Drizzle handles pool creation internally
const users = await db.select().from(usersTable);
```

**Correct (with connection options):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';

const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    // Additional connection options
    options: {
      encrypt: true,  // Required for Azure SQL
      trustServerCertificate: true,  // For local dev with self-signed certs
    },
  },
});
```

**Correct (with existing pool):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';

// Must await the pool connection
const pool = await mssql.connect({
  server: 'localhost',
  database: 'mydb',
  user: 'sa',
  password: 'password',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const db = drizzle({ client: pool });
```

**Application initialization pattern:**

```typescript
// db.ts
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';
import * as schema from './schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: mssql.ConnectionPool | null = null;

export async function getDb() {
  if (db) return db;

  pool = await mssql.connect({
    server: process.env.DB_SERVER!,
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate: process.env.NODE_ENV === 'development',
    },
  });

  db = drizzle({ client: pool, schema });
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.close();
    pool = null;
    db = null;
  }
}
```

**Usage in application:**

```typescript
// app.ts
import { getDb, closeDb } from './db';
import { users } from './schema';

async function main() {
  const db = await getDb();

  // Now safe to use
  const allUsers = await db.select().from(users);
  console.log(allUsers);

  // Clean up on exit
  await closeDb();
}

main().catch(console.error);
```

**Express/API pattern:**

```typescript
import express from 'express';
import { getDb } from './db';
import { users } from './schema';

const app = express();

app.get('/users', async (req, res) => {
  const db = await getDb();  // Pool is reused after first call
  const allUsers = await db.select().from(users);
  res.json(allUsers);
});

app.listen(3000);
```

**Accessing the raw pool:**

```typescript
const db = drizzle({ client: pool });

// Access underlying pool (already awaited)
const rawPool = db.$client;

// For operations not supported by Drizzle
const request = rawPool.request();
const result = await request.query('SELECT @@VERSION');
```

**Guidelines:**
- Always await the mssql.connect() before passing to drizzle
- Prefer passing connection string directly for simpler setup
- Use `encrypt: true` for Azure SQL Database
- Use `trustServerCertificate: true` only in development
- Reuse the connection pool across requests - don't create new pools per request
- Close the pool gracefully on application shutdown
