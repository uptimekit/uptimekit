import { NextResponse } from "next/server";
import { withEvlog } from "@/lib/evlog";

function handleGet() {
	return NextResponse.json({ ok: true });
}

export const GET = withEvlog(handleGet);
