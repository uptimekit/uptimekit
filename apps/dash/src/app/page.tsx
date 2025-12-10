"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
	return (
		<div className="flex h-screen w-full flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">UptimeKit</h1>
			<div className="flex gap-4">
				<Button asChild>
					<Link href="/login">Login</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href="/register">Register</Link>
				</Button>
			</div>
		</div>
	);
}
