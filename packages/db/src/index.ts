import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let _db: NodePgDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
	get(_target, prop) {
		if (!_db) {
			_db = drizzle(process.env.DATABASE_URL || "", { schema });
		}
		return Reflect.get(_db, prop);
	},
});

export * from "./clickhouse";
export * from "./schema";
