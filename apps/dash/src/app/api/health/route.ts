import { NextResponse } from "next/server";
import { withEvlog } from "@/lib/evlog";

export const GET = withEvlog(function GET() {
	return NextResponse.json({ ok: true });
});
