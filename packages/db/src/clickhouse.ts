import { type ClickHouseClient, createClient } from "@clickhouse/client";

let _clickhouse: ClickHouseClient | null = null;

export const clickhouse = new Proxy({} as ClickHouseClient, {
	get(_target, prop) {
		if (!_clickhouse) {
			_clickhouse = createClient({
				url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
				username: process.env.CLICKHOUSE_USER || "default",
				password: process.env.CLICKHOUSE_PASSWORD || "",
			});
		}
		return Reflect.get(_clickhouse, prop);
	},
});
