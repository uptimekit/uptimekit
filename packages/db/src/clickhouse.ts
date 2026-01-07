import { type ClickHouseClient, createClient } from "@clickhouse/client";

let _clickhouse: ClickHouseClient | null = null;

function getClickHouse(): ClickHouseClient {
	if (!_clickhouse) {
		_clickhouse = createClient({
			url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
			username: process.env.CLICKHOUSE_USER || "default",
			password: process.env.CLICKHOUSE_PASSWORD || "",
			// Add connection timeout and retry settings
			request_timeout: 30000,
			max_open_connections: 10,
		});
	}
	return _clickhouse;
}

// Export getter function instead of Proxy
export const clickhouse = new Proxy({} as ClickHouseClient, {
	get(_target, prop) {
		return Reflect.get(getClickHouse(), prop);
	},
	apply(_target, thisArg, args) {
		return Reflect.apply(getClickHouse() as any, thisArg, args);
	},
});
