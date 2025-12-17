"use client";

import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
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

interface ConfigDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	integration: IntegrationDefinition;
	initialConfig?: any;
	onSave: (config: any) => Promise<void>;
}

export function ConfigDialog({
	open,
	onOpenChange,
	integration,
	initialConfig,
	onSave,
}: ConfigDialogProps) {
	const [config, setConfig] = useState<Record<string, any>>(
		initialConfig || {},
	);
	const [saving, setSaving] = useState(false);

	// Basic schema parsing for MVP (assumes object with string fields)
	// In a real robust system, use something like 'auto-form'
	const shape = (integration.configSchema as any).shape;
	const fields = Object.keys(shape || {});

	const handleSave = async () => {
		try {
			// Validate client-side
			integration.configSchema.parse(config);
		} catch (e) {
			if (e instanceof z.ZodError) {
				const zodError = e as z.ZodError<any>;
				toast.error("Validation failed: " + zodError.issues[0].message);
				return;
			}
		}

		setSaving(true);
		try {
			await onSave(config);
			onOpenChange(false);
			toast.success("Integration saved");
		} catch (error) {
			toast.error("Failed to save integration");
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Configure {integration.name}</DialogTitle>
					<DialogDescription>{integration.description}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					{fields.map((field) => {
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
					})}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
