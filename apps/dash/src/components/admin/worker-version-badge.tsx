"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function compareVersions(current: string, latest: string): boolean {
	const c = current.split(".").map(Number);
	const l = latest.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		if ((c[i] || 0) < (l[i] || 0)) return true;
		if ((c[i] || 0) > (l[i] || 0)) return false;
	}
	return false;
}

export function WorkerVersionBadge({ version }: { version: string | null }) {
	const { data } = useQuery({
		queryKey: ["github-latest-release"],
		queryFn: async () => {
			const res = await fetch("/api/github/latest-release");
			if (!res.ok) throw new Error("Failed to fetch");
			return res.json();
		},
		staleTime: 15 * 60 * 1000,
		retry: 1,
	});

	if (!version) {
		return <Badge variant="outline">Unknown</Badge>;
	}

	const isOutdated = data?.version && compareVersions(version, data.version);

	return (
		<div className="flex items-center gap-2">
			<Badge variant={isOutdated ? "destructive" : "outline"}>v{version}</Badge>
			{isOutdated && (
				<Badge variant="secondary" className="flex items-center gap-1">
					<ArrowUp className="h-3 w-3" />v{data.version} available
				</Badge>
			)}
		</div>
	);
}
