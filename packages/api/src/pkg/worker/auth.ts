import { db } from "@uptimekit/db";
import { worker, workerApiKey } from "@uptimekit/db/schema/workers";
import { eq } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const logger = createLogger("WORKER-AUTH");

export interface WorkerContext {
	worker: {
		id: string;
		name: string;
		location: string;
		active: boolean;
	};
}

// Cache entry for authenticated workers
interface CacheEntry {
	workerContext: WorkerContext;
	expiresAt: number;
}

// In-memory cache for API key hash -> worker context
// TTL: 60 seconds - balances security (key revocation) vs performance
const apiKeyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Negative cache for invalid keys (shorter TTL to limit attack window)
const invalidKeyCache = new Map<string, number>();
const INVALID_CACHE_TTL_MS = 10 * 1000; // 10 seconds

/**
 * Removes expired entries from both API key caches.
 *
 * Iterates the positive `apiKeyCache` and negative `invalidKeyCache`, deleting any entries whose `expiresAt` timestamp is earlier than the current time.
 */
function cleanupCache() {
	const now = Date.now();
	for (const [key, entry] of apiKeyCache.entries()) {
		if (entry.expiresAt < now) {
			apiKeyCache.delete(key);
		}
	}
	for (const [key, expiresAt] of invalidKeyCache.entries()) {
		if (expiresAt < now) {
			invalidKeyCache.delete(key);
		}
	}
}

// Run cleanup every 30 seconds
setInterval(cleanupCache, 30 * 1000);

/**
 * Compute the SHA-256 hash of an API key and return it as a lowercase hex string.
 *
 * @param key - The raw API key to hash.
 * @returns The SHA-256 digest of `key` encoded as a lowercase hexadecimal string.
 */
async function hashApiKey(key: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(key);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Authenticate an incoming Request using a Bearer API key and return the corresponding worker context.
 *
 * @param request - HTTP request whose `Authorization` header must be `Bearer <apiKey>`
 * @returns The authenticated `WorkerContext` on success; otherwise an object `{ error: string; status: number }`
 *          describing the failure and the HTTP status code
 */
export async function authenticateWorker(
	request: Request,
): Promise<WorkerContext | { error: string; status: number }> {
	const authHeader = request.headers.get("authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		return { error: "Missing or invalid Authorization header", status: 401 };
	}

	const token = authHeader.split(" ")[1];
	if (!token) {
		return { error: "Missing token", status: 401 };
	}

	const now = Date.now();

	// Hash the token for lookup
	const keyHash = await hashApiKey(token);

	// Check negative cache first (invalid keys)
	const invalidExpiry = invalidKeyCache.get(keyHash);
	if (invalidExpiry && invalidExpiry > now) {
		return { error: "Invalid API Key", status: 401 };
	}

	// Check positive cache
	const cached = apiKeyCache.get(keyHash);
	if (cached && cached.expiresAt > now) {
		// Return cached result, but still update heartbeat asynchronously
		updateHeartbeatAsync(cached.workerContext.worker.id);
		return cached.workerContext;
	}

	// Cache miss - query database
	const keyRecord = await db.query.workerApiKey.findFirst({
		where: (t, { eq }) => eq(t.keyHash, keyHash),
		with: {
			worker: true,
		},
	});

	if (!keyRecord?.worker) {
		// Cache invalid key
		invalidKeyCache.set(keyHash, now + INVALID_CACHE_TTL_MS);
		return { error: "Invalid API Key", status: 401 };
	}

	const workerRecord = keyRecord.worker;

	if (!workerRecord.active) {
		// Cache as invalid (worker inactive)
		invalidKeyCache.set(keyHash, now + INVALID_CACHE_TTL_MS);
		return { error: "Worker not found or inactive", status: 401 };
	}

	// Build result
	const result: WorkerContext = {
		worker: {
			id: workerRecord.id,
			name: workerRecord.name,
			location: workerRecord.location,
			active: workerRecord.active,
		},
	};

	// Cache the result
	apiKeyCache.set(keyHash, {
		workerContext: result,
		expiresAt: now + CACHE_TTL_MS,
	});

	// Update heartbeat and last used timestamp
	await Promise.all([
		db
			.update(worker)
			.set({ lastHeartbeat: new Date() })
			.where(eq(worker.id, workerRecord.id)),
		db
			.update(workerApiKey)
			.set({ lastUsedAt: new Date() })
			.where(eq(workerApiKey.id, keyRecord.id)),
	]);

	return result;
}

/**
 * Update the worker's lastHeartbeat timestamp in the database without blocking the caller.
 *
 * Errors encountered while performing the update are logged and not propagated.
 *
 * @param workerId - The ID of the worker whose heartbeat should be updated
 */
function updateHeartbeatAsync(workerId: string) {
	db.update(worker)
		.set({ lastHeartbeat: new Date() })
		.where(eq(worker.id, workerId))
		.catch((err) => logger.error("Failed to update heartbeat:", err));
}

/**
 * Determines whether the provided result represents an authentication error.
 *
 * @param result - The value to test for an authentication error object
 * @returns `true` if `result` is an error object containing `error` and `status`, `false` otherwise
 */
export function isAuthError(
	result: WorkerContext | { error: string; status: number },
): result is { error: string; status: number } {
	return "error" in result;
}

/**
 * Remove cached entries for a specific API key hash or clear all API key caches.
 *
 * @param keyHash - Hexadecimal SHA-256 hash of the API key to invalidate; if omitted, both positive and negative API key caches are fully cleared
 */
export function invalidateApiKeyCache(keyHash?: string) {
	if (keyHash) {
		apiKeyCache.delete(keyHash);
		invalidKeyCache.delete(keyHash);
	} else {
		apiKeyCache.clear();
		invalidKeyCache.clear();
	}
}

// Export hash function for use in worker creation/rotation
export { hashApiKey };
