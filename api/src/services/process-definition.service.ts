import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { processDefinitions } from '../db/schema/index';

export async function listProcesses(isActive?: boolean) {
  const db = await getDb();
  if (isActive !== undefined) {
    return db
      .select()
      .from(processDefinitions)
      .where(eq(processDefinitions.isActive, isActive));
  }
  return db.select().from(processDefinitions);
}

export async function createProcess(data: {
  processName: string;
  displayName: string;
  description: string;
  owningTeam: string;
  expectedSteps?: number;
  slaMs?: number;
}) {
  const db = await getDb();
  // MSSQL uses .output() instead of .returning()
  const [result] = await db
    .insert(processDefinitions)
    .output()
    .values(data);

  return result;
}
