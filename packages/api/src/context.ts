import { auth } from "@uptimekit/auth";
import type { NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: req.headers,
	});
	return {
		session,
		headers: req.headers as Headers,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
