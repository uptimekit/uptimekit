import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
import { apikey } from "@uptimekit/db/schema/auth";
import { eq } from "drizzle-orm";
// Cleaned up unused imports
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { WorkerApiKeyManager } from "@/components/admin/worker-api-key-manager";

async function getWorker(id: string) {
	const w = await db
		.select({
			worker: worker,
			apiKey: apikey,
		})
		.from(worker)
		.leftJoin(apikey, eq(worker.apiKeyId, apikey.id))
		.where(eq(worker.id, id))
		.limit(1);

	if (!w.length) return null;
	return w[0];
}

export default async function EditWorkerPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const data = await getWorker(id);

	if (!data) {
		notFound();
	}

	const { worker: w, apiKey: k } = data;

	return (
		<div className="flex flex-col gap-4 p-4 pt-0">
			<div className="flex items-center gap-4">
				<Button variant="outline" size="icon" asChild>
					<Link href="/admin/workers">
						<ChevronLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex flex-col">
					<h1 className="text-2xl font-bold tracking-tight">Edit Worker</h1>
					<p className="text-muted-foreground text-sm">{w.id}</p>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>General Information</CardTitle>
						<CardDescription>Update worker details.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-2">
							<Label>Name</Label>
							<Input defaultValue={w.name} disabled />
							<p className="text-[0.8rem] text-muted-foreground">
								Editing name is currently disabled.
							</p>
						</div>
						<div className="grid gap-2">
							<Label>Location</Label>
							<Input defaultValue={w.location} disabled />
							<p className="text-[0.8rem] text-muted-foreground">
								Location cannot be changed after creation.
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Authentication</CardTitle>
						<CardDescription>
							Manage the API key for this worker.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-2">
							<Label>API Key Status</Label>
							<div className="flex items-center gap-2">
								<div
									className={`h-2.5 w-2.5 rounded-full ${k?.enabled ? "bg-green-500" : "bg-red-500"}`}
								/>
								<span className="text-sm font-medium">
									{k?.enabled ? "Active" : "Inactive"}
								</span>
							</div>
						</div>
						{k && (
							<div className="grid gap-1">
								<Label>Key Prefix</Label>
								<code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
									{k.prefix || "N/A"}
								</code>
							</div>
						)}
						<Separator />
						<WorkerApiKeyManager workerId={w.id} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
