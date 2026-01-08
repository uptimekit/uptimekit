"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function IncidentsPage() {
	const router = useRouter();

	useEffect(() => {
		router.push("/");
	}, [router]);

	return <div className="container mx-auto py-6">How did you got there</div>;
}
