import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
	memoryCost: 65536, // 64 MB
	timeCost: 3,
	parallelism: 4,
};

export async function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
	hash: string,
	password: string,
): Promise<boolean> {
	try {
		return await verify(hash, password);
	} catch {
		return false;
	}
}
