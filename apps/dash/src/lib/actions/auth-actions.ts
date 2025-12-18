"use server";

import { auth } from "@uptimekit/auth";
import { headers } from "next/headers";

export async function setUserPassword(password: string) {
	const userHeaders = await headers();
	try {
		await auth.api.setPassword({
			body: { newPassword: password },
			headers: userHeaders,
		});
		return { success: true };
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
}
