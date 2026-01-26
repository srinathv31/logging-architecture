---
title: Drizzle Relations
impact: HIGH
impactDescription: enables type-safe relational queries
tags: schema, relations, joins, queries
---

## Drizzle Relations

Drizzle relations define relationships between tables for type-safe queries with the relational query API. They are separate from foreign keys - relations are for query building, foreign keys are for database constraints.

**Incorrect (no relations defined):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
});

// Can't use relational queries without relations defined
// db.query.users.findMany({ with: { posts: true } })  // Error!
```

**Correct (relations defined):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';
import { relations } from 'drizzle-orm';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// Now relational queries work
const result = await db.query.users.findMany({
  with: { posts: true },
});
```

**One-to-one relation:**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const profiles = mssqlTable('profiles', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  bio: nvarchar('bio', { length: 'max' }),
});

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));
```

**Many-to-many relation:**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
});

export const groups = mssqlTable('groups', {
  id: int('id').primaryKey(),
});

export const usersToGroups = mssqlTable('users_to_groups', {
  userId: int('user_id').notNull().references(() => users.id),
  groupId: int('group_id').notNull().references(() => groups.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  user: one(users, { fields: [usersToGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [usersToGroups.groupId], references: [groups.id] }),
}));
```

Relations are TypeScript-only - they don't affect the database schema. Always pair them with actual foreign key constraints for data integrity.
