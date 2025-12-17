"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orpc } from "@/utils/orpc";

interface WorkerApiKeyManagerProps {
	workerId: string;
}

export function WorkerApiKeyManager({ workerId }: WorkerApiKeyManagerProps) {
	const [newKey, setNewKey] = useState<string | null>(null);
	const [showConfirm, setShowConfirm] = useState(false);
	const [isRevealed, setIsRevealed] = useState(false);
	const router = useRouter();

	const { mutate, isPending } = useMutation({
		...orpc.workers.rotateKey.mutationOptions(),
		onSuccess: (data: { key: string }) => {
			setNewKey(data.key);
			toast.success("API Key rotated successfully");
		},
		onError: (error: Error) => {
			console.error(error);
			toast.error("Failed to rotate API Key");
		},
	});

	const handleRotate = () => {
		setShowConfirm(false);
		mutate({ id: workerId });
	};

	const handleCopy = () => {
		if (newKey) {
			navigator.clipboard.writeText(newKey);
			setIsRevealed(true);
			toast.success("Copied to clipboard");
		}
	};

	const handleCloseNewKeyDialog = () => {
		setNewKey(null);
		setIsRevealed(false);
		router.refresh();
	};

	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="secondary"
				className="w-full"
				onClick={() => setShowConfirm(true)}
				disabled={isPending}
			>
				{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
				Rotate API Key
			</Button>
			<p className="text-[0.8rem] text-muted-foreground">
				Rotating the key will immediately invalidate the old one. The worker
				will need the new key to connect.
			</p>

			{/* Confirmation Dialog */}
			<Dialog open={showConfirm} onOpenChange={setShowConfirm}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rotate API Key?</DialogTitle>
						<DialogDescription>
							Are you sure you want to rotate the API key? The existing key will
							stop working immediately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowConfirm(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleRotate}>
							Rotate Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* New Key Display Dialog */}
			<Dialog
				open={!!newKey}
				onOpenChange={(open) => !open && handleCloseNewKeyDialog()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New API Key Generated</DialogTitle>
						<DialogDescription>
							Please copy this key immediately. You will not be able to see it
							again.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center space-x-2">
						<div className="grid flex-1 gap-2">
							<Label htmlFor="link" className="sr-only">
								Link
							</Label>
							<Input
								id="link"
								value={newKey || ""}
								readOnly
								type={isRevealed ? "text" : "password"}
							/>
						</div>
						<Button
							type="submit"
							size="sm"
							className="px-3"
							onClick={handleCopy}
						>
							<span className="sr-only">Copy</span>
							{isRevealed ? (
								<Check className="h-4 w-4" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>
					<DialogFooter>
						<Button onClick={handleCloseNewKeyDialog}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
