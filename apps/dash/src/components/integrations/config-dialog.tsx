/** biome-ignore-all lint/suspicious/noExplicitAny: configs arent 100% typed */
"use client";

import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { z } from "zod";
import { AlertManagerConfig } from "@/components/integrations/alertmanager-config";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogPopup,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ConfigDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	integration: IntegrationDefinition;
	initialConfig?: any;
	configId?: string;
	initialName?: string;
	initialActive?: boolean;
	initialIsDefault?: boolean;
	onSave: (values: {
		name: string;
		config: any;
		active: boolean;
		isDefault: boolean;
		applyToExistingMonitors: boolean;
	}) => Promise<void>;
	onDelete?: () => Promise<void>;
	onTest?: () => Promise<void>;
}

export function ConfigDialog({
	open,
	onOpenChange,
	integration,
	initialConfig,
	configId,
	initialName,
	initialActive = true,
	initialIsDefault = false,
	onSave,
	onDelete,
	onTest,
}: ConfigDialogProps) {
	const [name, setName] = useState(initialName || integration.name);
	const [config, setConfig] = useState<Record<string, any>>(
		initialConfig || {},
	);
	const [active, setActive] = useState(initialActive);
	const [isDefault, setIsDefault] = useState(initialIsDefault);
	const [applyToExistingMonitors, setApplyToExistingMonitors] = useState(false);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	useEffect(() => {
		setName(initialName || integration.name);
		setConfig(initialConfig || {});
		setActive(initialActive);
		setIsDefault(initialIsDefault);
		setApplyToExistingMonitors(false);
	}, [
		initialActive,
		initialConfig,
		initialIsDefault,
		initialName,
		integration.name,
	]);

	// Basic schema parsing for MVP (assumes object with string fields)
	// In a real robust system, use something like 'auto-form'
	const shape = (integration.configSchema as any).shape;
	const fields = Object.keys(shape || {});

	const isImportIntegration = integration.type === "import";

	const handleSave = async () => {
		if (!name.trim()) {
			sileo.error({ title: "Notification name is required" });
			return;
		}

		try {
			// Validate client-side
			integration.configSchema.parse(config);
		} catch (e) {
			if (e instanceof z.ZodError) {
				const zodError = e as z.ZodError<any>;
				sileo.error({
					title: `Validation failed: ${zodError.issues[0].message}`,
				});
				return;
			}
		}

		setSaving(true);
		try {
			await onSave({
				name: name.trim(),
				config,
				active,
				isDefault,
				applyToExistingMonitors,
			});
			onOpenChange(false);
			sileo.success({ title: "Notification saved" });
		} catch (error: any) {
			sileo.error({ title: error.message || "Failed to save notification" });
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
			sileo.success({
				title: "Test event sent successfully! Check your integration endpoint.",
			});
		} catch (error: any) {
			sileo.error({ title: error.message || "Failed to send test event" });
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
			sileo.success({ title: "Notification removed" });
		} catch (error: any) {
			sileo.error({ title: error.message || "Failed to remove notification" });
			console.error(error);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogPopup className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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

						<div className="grid w-full items-center gap-1.5">
							<Label htmlFor="notification-name">Name</Label>
							<Input
								id="notification-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={integration.name}
							/>
						</div>

						<div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
							<div className="flex flex-col gap-1">
								<Label htmlFor="notification-active">Active</Label>
								<p className="text-muted-foreground text-sm">
									Inactive notifications stay assigned but do not send events.
								</p>
							</div>
							<Switch
								id="notification-active"
								checked={active}
								onCheckedChange={setActive}
							/>
						</div>

						<div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
							<div className="flex flex-col gap-1">
								<Label htmlFor="notification-default">Default</Label>
								<p className="text-muted-foreground text-sm">
									Automatically select this notification for new monitors.
								</p>
							</div>
							<Switch
								id="notification-default"
								checked={isDefault}
								onCheckedChange={setIsDefault}
							/>
						</div>

						<div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
							<Checkbox
								id="notification-apply-existing"
								checked={applyToExistingMonitors}
								onCheckedChange={(checked) =>
									setApplyToExistingMonitors(checked === true)
								}
							/>
							<div className="flex flex-col gap-1">
								<Label htmlFor="notification-apply-existing">
									Apply to existing monitors
								</Label>
								<p className="text-muted-foreground text-sm">
									Add this notification to all current monitors without removing
									other assignments.
								</p>
							</div>
						</div>
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
							<DialogClose render={<Button variant="ghost" />}>
								Cancel
							</DialogClose>
							<Button
								onClick={handleSave}
								disabled={saving || testing || deleting}
							>
								{saving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</DialogFooter>
				</DialogPopup>
			</Dialog>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove notification</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove this notification? This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDelete}
							disabled={deleting}
						>
							{deleting ? "Removing..." : "Remove"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
