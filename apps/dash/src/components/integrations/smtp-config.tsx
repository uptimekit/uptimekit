"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type SmtpSecureMode = "auto" | "true" | "false";

interface SmtpConfigValues {
	host?: string;
	port?: number | string;
	secure?: SmtpSecureMode;
	username?: string;
	password?: string;
	from?: string;
	to?: string;
}

interface SmtpConfigProps {
	config: SmtpConfigValues;
	onChange: (config: SmtpConfigValues) => void;
}

const secureOptions = [
	{ label: "Auto", value: "auto" },
	{ label: "TLS", value: "true" },
	{ label: "STARTTLS", value: "false" },
] as const;

export function SmtpConfig({ config, onChange }: SmtpConfigProps) {
	const selectedSecure =
		secureOptions.find(
			(option) => option.value === (config.secure || "auto"),
		) || secureOptions[0];

	const setConfigValue = (
		key: keyof SmtpConfigValues,
		value: SmtpConfigValues[keyof SmtpConfigValues],
	) => {
		onChange({ ...config, [key]: value });
	};

	const setPort = (value: string) => {
		if (!value) {
			const nextConfig = { ...config };
			delete nextConfig.port;
			onChange(nextConfig);
			return;
		}

		setConfigValue("port", Number(value));
	};

	return (
		<div className="grid gap-4">
			<div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
				<div className="grid gap-1.5">
					<Label htmlFor="smtp-host">Host</Label>
					<Input
						id="smtp-host"
						value={config.host || ""}
						onChange={(event) => setConfigValue("host", event.target.value)}
						placeholder="smtp.example.com"
					/>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="smtp-port">Port</Label>
					<Input
						id="smtp-port"
						type="number"
						min={1}
						max={65_535}
						value={config.port ?? ""}
						onChange={(event) => setPort(event.target.value)}
						placeholder="587"
					/>
				</div>
			</div>

			<div className="grid gap-1.5">
				<Label htmlFor="smtp-secure">Security</Label>
				<Select
					value={config.secure || "auto"}
					onValueChange={(value: SmtpSecureMode | null) =>
						setConfigValue("secure", value || "auto")
					}
				>
					<SelectTrigger id="smtp-secure">
						<SelectValue placeholder="Select security mode">
							{selectedSecure.label}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{secureOptions.map(({ label, value }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-1.5">
					<Label htmlFor="smtp-username">Username</Label>
					<Input
						id="smtp-username"
						value={config.username || ""}
						onChange={(event) => setConfigValue("username", event.target.value)}
						placeholder="alerts"
					/>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="smtp-password">Password</Label>
					<Input
						id="smtp-password"
						type="password"
						value={config.password || ""}
						onChange={(event) => setConfigValue("password", event.target.value)}
						placeholder="Application password"
					/>
				</div>
			</div>

			<div className="grid gap-1.5">
				<Label htmlFor="smtp-from">From</Label>
				<Input
					id="smtp-from"
					type="email"
					value={config.from || ""}
					onChange={(event) => setConfigValue("from", event.target.value)}
					placeholder="alerts@example.com"
				/>
			</div>

			<div className="grid gap-1.5">
				<Label htmlFor="smtp-to">Recipients</Label>
				<Input
					id="smtp-to"
					value={config.to || ""}
					onChange={(event) => setConfigValue("to", event.target.value)}
					placeholder="ops@example.com, dev@example.com"
				/>
			</div>
		</div>
	);
}
