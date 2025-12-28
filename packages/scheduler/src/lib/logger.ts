type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Creates a logger with consistent formatting across all services.
 * Format: [ISO_TIMESTAMP] [SERVICE] [LEVEL] message
 *
 * @param service - Service name to prefix logs with (e.g., "SCHEDULER", "API")
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
