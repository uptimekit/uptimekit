/** biome-ignore-all lint/suspicious/noExplicitAny: configs arent 100% typed */
"use client";

import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AlertManagerConfig } from "@/components/integrations/alertmanager-config";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfigDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	integration: IntegrationDefinition;
	initialConfig?: any;
	configId?: string;
	onSave: (config: any) => Promise<void>;
	onDelete?: () => Promise<void>;
	onTest?: () => Promise<void>;
}

export function ConfigDialog({
	open,
	onOpenChange,
	integration,
	initialConfig,
	configId,
	onSave,
	onDelete,
	onTest,
}: ConfigDialogProps) {
	const [config, setConfig] = useState<Record<string, any>>(
		initialConfig || {},
	);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	// Basic schema parsing for MVP (assumes object with string fields)
	// In a real robust system, use something like 'auto-form'
	const shape = (integration.configSchema as any).shape;
	const fields = Object.keys(shape || {});

	const isImportIntegration = integration.type === "import";

	const handleSave = async () => {
		try {
			// Validate client-side
			integration.configSchema.parse(config);
		} catch (e) {
			if (e instanceof z.ZodError) {
				const zodError = e as z.ZodError<any>;
				toast.error(`Validation failed: ${zodError.issues[0].message}`);
				return;
			}
		}

		setSaving(true);
		try {
			await onSave(config);
			onOpenChange(false);
			toast.success("Integration saved");
		} catch (error: any) {
			toast.error(error.message || "Failed to save integration");
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	const handleTest = async () => {
		if (!onTest) return;

		setTesting(true);
		try {
			await onTest();
			toast.success(
				"Test event sent successfully! Check your integration endpoint.",
			);
		} catch (error: any) {
			toast.error(error.message || "Failed to send test event");
			console.error(error);
		} finally {
			setTesting(false);
		}
	};

	const handleDelete = async () => {
		if (!onDelete) return;

		setDeleting(true);
		try {
			await onDelete();
			setDeleteDialogOpen(false);
			onOpenChange(false);
			toast.success("Integration removed");
		} catch (error: any) {
			toast.error(error.message || "Failed to remove integration");
			console.error(error);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Configure {integration.name}</DialogTitle>
						<DialogDescription>{integration.description}</DialogDescription>
					</DialogHeader>

					<DialogPanel className="grid gap-4">
						{integration.id === "alertmanager" ? (
							<AlertManagerConfig
								config={config}
								configId={configId}
								onChange={setConfig}
							/>
						) : (
							fields.map((field) => {
								// Detect type if possible, default to text
								const isSecret =
									field.toLowerCase().includes("secret") ||
									field.toLowerCase().includes("token");

								return (
									<div key={field} className="grid w-full items-center gap-1.5">
										<Label htmlFor={field} className="capitalize">
											{field}
										</Label>
										<Input
											id={field}
											type={isSecret ? "password" : "text"}
											value={config[field] || ""}
											onChange={(e) =>
												setConfig({ ...config, [field]: e.target.value })
											}
											placeholder={`Enter ${field}...`}
										/>
									</div>
								);
							})
						)}
					</DialogPanel>

					<DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
						<div className="flex gap-2">
							{configId && onDelete && (
								<Button
									variant="destructive"
									onClick={() => setDeleteDialogOpen(true)}
									disabled={deleting || saving || testing}
								>
									Remove
								</Button>
							)}
						</div>
						<div className="flex gap-2">
							{configId && onTest && !isImportIntegration && (
								<Button
									variant="outline"
									onClick={handleTest}
									disabled={testing || saving || deleting}
								>
									{testing ? "Testing..." : "Test"}
								</Button>
							)}
							<Button
								onClick={handleSave}
								disabled={saving || testing || deleting}
							>
								{saving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove integration</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove this integration? This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={deleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleting ? "Removing..." : "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
