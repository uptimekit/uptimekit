"use client";

import { Check, ChevronDown, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface AlertManagerConfigProps {
	config: {
		bearerToken?: string;
		autoResolve?: boolean;
		defaultSeverity?: "minor" | "major" | "critical";
		titleTemplate?: string;
	};
	configId?: string;
	onChange: (config: any) => void;
}

const severityOptions = [
	{ label: "Minor", value: "minor" },
	{ label: "Major", value: "major" },
	{ label: "Critical", value: "critical" },
] as const;

function generateToken(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function AlertManagerConfig({
	config,
	configId,
	onChange,
}: AlertManagerConfigProps) {
	const [copied, setCopied] = useState<"url" | "token" | "config" | null>(null);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [configRevealed, setConfigRevealed] = useState(false);
	const [tokenRevealed, setTokenRevealed] = useState(false);

	const isSecure =
		typeof window !== "undefined" && window.location.protocol === "https:";
	const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
	const webhookUrl = configId
		? `${baseUrl}/api/webhooks/integrations/${configId}`
		: "Save to generate webhook URL";

	const handleCopy = async (
		value: string,
		type: "url" | "token" | "config",
	) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(type);
			setTimeout(() => setCopied(null), 2000);
		} catch (error) {
			console.error("Failed to copy to clipboard:", error);
		}
	};

	const handleRegenerate = () => {
		onChange({ ...config, bearerToken: generateToken() });
	};

	const alertmanagerConfigDisplay = `receivers:
  - name: 'uptimekit'
    webhook_configs:
      - url: '${webhookUrl}'
        send_resolved: true
        http_config:
          authorization:
            credentials: '${config.bearerToken ? "••••••••" : "<your-token>"}'

route:
  receiver: 'uptimekit'
  # Or add it to your existing routes`;

	const alertmanagerConfigCopy = `receivers:
  - name: 'uptimekit'
    webhook_configs:
      - url: '${webhookUrl}'
        send_resolved: true
        http_config:
          authorization:
            credentials: '${config.bearerToken || "<your-token>"}'

route:
  receiver: 'uptimekit'
  # Or add it to your existing routes`;

	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Label>Webhook URL</Label>
				<div className="flex gap-2">
					<Input
						value={webhookUrl}
						readOnly
						className={cn(
							"min-w-0 font-mono text-sm",
							!configId && "text-muted-foreground",
						)}
					/>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => handleCopy(webhookUrl, "url")}
						disabled={!configId}
					>
						{copied === "url" ? (
							<Check className="h-4 w-4" />
						) : (
							<Copy className="h-4 w-4" />
						)}
					</Button>
				</div>
				{!configId && (
					<p className="text-muted-foreground text-sm">
						Save the integration first to generate a webhook URL.
					</p>
				)}
			</div>

			<div className="grid gap-2">
				<Label>Bearer Token</Label>
				<div className="flex gap-2">
					<Input
						type={tokenRevealed ? "text" : "password"}
						value={config.bearerToken || ""}
						onChange={(e) =>
							onChange({ ...config, bearerToken: e.target.value })
						}
						placeholder="Enter or generate a token"
						className="min-w-0 font-mono"
					/>
					{isSecure ? (
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() =>
								config.bearerToken && handleCopy(config.bearerToken, "token")
							}
							disabled={!config.bearerToken}
							title="Copy token"
						>
							{copied === "token" ? (
								<Check className="h-4 w-4" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					) : (
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => setTokenRevealed(!tokenRevealed)}
							disabled={!config.bearerToken}
							title={tokenRevealed ? "Hide token" : "Reveal token"}
						>
							{tokenRevealed ? (
								<EyeOff className="h-4 w-4" />
							) : (
								<Eye className="h-4 w-4" />
							)}
						</Button>
					)}
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleRegenerate}
						title="Generate new token"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					Used for Authorization header authentication. AlertManager will send
					this token with each request.
				</p>
			</div>

			<div className="flex items-center justify-between rounded-lg border p-4">
				<div className="space-y-0.5">
					<Label>Auto-resolve incidents</Label>
					<p className="text-muted-foreground text-sm">
						Automatically resolve incidents when AlertManager sends a resolved
						alert.
					</p>
				</div>
				<Switch
					checked={config.autoResolve ?? true}
					onCheckedChange={(checked) =>
						onChange({ ...config, autoResolve: checked })
					}
				/>
			</div>

			<div className="grid gap-2">
				<Label>Title Template</Label>
				<Input
					value={config.titleTemplate || "Alert: {{alertname}}"}
					onChange={(e) =>
						onChange({ ...config, titleTemplate: e.target.value })
					}
					placeholder="Alert: {{alertname}}"
				/>
				<p className="text-muted-foreground text-sm">
					Placeholders: {"{{alertname}}"}, {"{{instance}}"}, {"{{job}}"}, and
					any other label from your alerts.
				</p>
			</div>

			<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
				<CollapsibleTrigger
					render={<Button variant="ghost" className="w-full justify-between" />}
				>
					Advanced Settings
					<ChevronDown
						className={cn(
							"h-4 w-4 transition-transform",
							advancedOpen && "rotate-180",
						)}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent className="space-y-4 pt-4">
					<div className="grid gap-2">
						<Label>Default Severity</Label>
						{(() => {
							const selectedSeverity = severityOptions.find(
								(option) =>
									option.value === (config.defaultSeverity || "major"),
							);

							return (
								<Select
									value={config.defaultSeverity || "major"}
									onValueChange={(
										value: "minor" | "major" | "critical" | null,
									) => onChange({ ...config, defaultSeverity: value })}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select severity">
											{selectedSeverity?.label}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{severityOptions.map(({ label, value }) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							);
						})()}
						<p className="text-muted-foreground text-sm">
							Default severity when alert doesn't specify one. Alerts with
							severity label will map: critical=critical, warning=major,
							info=minor.
						</p>
					</div>
				</CollapsibleContent>
			</Collapsible>

			<div className="grid gap-2">
				<Label>AlertManager Configuration</Label>
				<p className="text-muted-foreground text-sm">
					Add this to your AlertManager configuration file:
				</p>
				<div className="relative">
					<pre className="whitespace-pre-wrap break-all rounded-lg border bg-muted p-4 pr-16 font-mono text-sm">
						{configRevealed
							? alertmanagerConfigCopy
							: alertmanagerConfigDisplay}
					</pre>
					{isSecure ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="absolute top-2 right-2"
							onClick={() => handleCopy(alertmanagerConfigCopy, "config")}
						>
							{copied === "config" ? (
								<Check className="mr-2 h-4 w-4" />
							) : (
								<Copy className="mr-2 h-4 w-4" />
							)}
							{copied === "config" ? "Copied" : "Copy"}
						</Button>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="absolute top-2 right-2"
							onClick={() => setConfigRevealed(!configRevealed)}
						>
							{configRevealed ? (
								<>
									<EyeOff className="mr-2 h-4 w-4" />
									Hide
								</>
							) : (
								<>
									<Eye className="mr-2 h-4 w-4" />
									Reveal
								</>
							)}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
