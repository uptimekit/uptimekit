import { NextResponse } from "next/server";

export function privateImageResponse() {
	return new NextResponse(null, {
		status: 404,
		headers: {
			"Cache-Control": "private, no-store",
		},
	});
}
