import { db } from "@uptimekit/db";
import { worker, workerApiKey } from "@uptimekit/db/schema/workers";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkerApiKeyManager } from "@/components/admin/worker-api-key-manager";
import { WorkerGeneralInfoForm } from "@/components/admin/worker-general-info-form";
import { ChevronLeft } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

async function getWorker(id: string) {
	const w = await db
		.select({
			worker: worker,
			apiKey: workerApiKey,
		})
		.from(worker)
		.leftJoin(workerApiKey, eq(workerApiKey.workerId, worker.id))
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
				<Button
					variant="outline"
					size="icon"
					render={<Link href="/admin/workers" />}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex flex-col">
					<h1 className="font-bold text-2xl tracking-tight">Edit Worker</h1>
					<p className="text-muted-foreground text-sm">{w.id}</p>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<WorkerGeneralInfoForm
					worker={{
						id: w.id,
						name: w.name,
						location: w.location,
					}}
				/>

				<Card>
					<CardHeader>
						<CardTitle>Authentication</CardTitle>
						<CardDescription>
							Manage the API key for this worker.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						{k && (
							<>
								<div className="flex items-center justify-between">
									<span className="font-medium text-sm">Key Hint</span>
									<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
										{k.keyHint}
									</code>
								</div>
								<div className="flex items-center justify-between">
									<span className="font-medium text-sm">Created</span>
									<span className="text-muted-foreground text-sm">
										{format(k.createdAt, "PPP p")}
									</span>
								</div>
								{k.lastUsedAt && (
									<div className="flex items-center justify-between">
										<span className="font-medium text-sm">Last Used</span>
										<span className="text-muted-foreground text-sm">
											{format(k.lastUsedAt, "PPP p")}
										</span>
									</div>
								)}
							</>
						)}
						<Separator />
						<WorkerApiKeyManager workerId={w.id} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
