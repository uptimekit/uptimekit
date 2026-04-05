type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
	debug: (msg: string, ...args: unknown[]) => void;
	info: (msg: string, ...args: unknown[]) => void;
	warn: (msg: string, ...args: unknown[]) => void;
	error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Create a logger that prefixes messages with an ISO timestamp, service name, and log level.
 *
 * Format: [ISO_TIMESTAMP] [SERVICE] [LEVEL] message
 *
 * @param service - Service name to prefix logs with (e.g., "SCHEDULER", "API")
 * @returns A Logger with `debug`, `info`, `warn`, and `error` methods that emit messages prefixed as shown above
 */
export function createLogger(service: string): Logger {
	const log = (level: LogLevel, msg: string, args: unknown[]) => {
		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${service}] [${level.toUpperCase()}]`;
		console[level](prefix, msg, ...args);
	};

	return {
		debug: (msg: string, ...args: unknown[]) => log("debug", msg, args),
		info: (msg: string, ...args: unknown[]) => log("info", msg, args),
		warn: (msg: string, ...args: unknown[]) => log("warn", msg, args),
		error: (msg: string, ...args: unknown[]) => log("error", msg, args),
	};
}
