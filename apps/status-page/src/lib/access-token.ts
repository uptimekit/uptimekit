import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_EXPIRY_HOURS = 24;

interface TokenPayload {
	statusPageId: string;
	expiresAt: number;
}

function getSecret(): string {
	const secret =
		process.env.STATUS_PAGE_ACCESS_SECRET || process.env.BETTER_AUTH_SECRET;

	if (!secret) {
		throw new Error(
			"Missing required environment variable: STATUS_PAGE_ACCESS_SECRET or BETTER_AUTH_SECRET must be set",
		);
	}

	return secret;
}

function sign(payload: TokenPayload): string {
	const data = JSON.stringify(payload);
	const signature = createHmac("sha256", getSecret())
		.update(data)
		.digest("hex");
	return Buffer.from(JSON.stringify({ ...payload, signature })).toString(
		"base64url",
	);
}

function verify(token: string): TokenPayload | null {
	try {
		const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
		const { signature, ...payload } = decoded;

		const expectedSignature = createHmac("sha256", getSecret())
			.update(JSON.stringify(payload))
			.digest("hex");

		if (signature.length !== expectedSignature.length) {
			return null;
		}

		const signatureBuffer = Buffer.from(signature, "utf8");
		const expectedBuffer = Buffer.from(expectedSignature, "utf8");

		if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
			return null;
		}

		if (Date.now() > payload.expiresAt) {
			return null;
		}

		return payload as TokenPayload;
	} catch {
		return null;
	}
}

export function generateAccessToken(statusPageId: string): string {
	const expiresAt = Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
	return sign({ statusPageId, expiresAt });
}

export function verifyAccessToken(
	token: string,
	statusPageId: string,
): boolean {
	const payload = verify(token);
	return payload !== null && payload.statusPageId === statusPageId;
}

export function getCookieName(statusPageId: string): string {
	return `sp_access_${statusPageId}`;
}
