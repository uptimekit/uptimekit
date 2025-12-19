"use client";

import { useRouter } from "next/navigation";

export default function IncidentsPage() {
	const router = useRouter();

	router.push("/");
	return <div className="container mx-auto py-6">How did you got there</div>;
}
