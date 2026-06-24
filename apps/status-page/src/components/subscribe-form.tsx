"use client";

import { faCircleCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type FormEvent, useState } from "react";
import { cn } from "@/lib/utils";

interface SubscribeFormProps {
	statusPageId: string;
	className?: string;
	variant?: "default" | "flat" | "signal";
	mode?: "card" | "compact";
}

interface SubscribeState {
	error: string;
	success: string;
}

const variantStyles = {
	default: {
		card: "rounded-2xl border border-border bg-card/90 p-5 shadow-sm",
		trigger:
			"inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90",
		panel: "border border-border bg-background shadow-xl",
		button:
			"inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60",
		cancel:
			"inline-flex h-11 items-center justify-center rounded-xl bg-muted px-4 font-medium text-foreground text-sm transition-colors hover:bg-muted/80",
	},
	flat: {
		card: "rounded-2xl border border-border/50 bg-background p-5 shadow-sm",
		trigger:
			"inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-3 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 dark:bg-muted dark:hover:bg-neutral-700!",
		panel: "border border-border bg-background shadow-xl",
		button:
			"inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-4 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-60 dark:bg-muted dark:hover:bg-neutral-700!",
		cancel:
			"inline-flex h-11 items-center justify-center rounded-xl bg-muted px-4 font-medium text-foreground text-sm transition-colors hover:bg-muted/80",
	},
	signal: {
		card: "signal-panel rounded-2xl border border-border/70 p-5",
		trigger:
			"signal-button inline-flex h-8 items-center justify-center rounded-lg px-3 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px",
		panel: "signal-panel border border-border/70 bg-background shadow-xl",
		button:
			"signal-button inline-flex h-11 items-center justify-center rounded-xl px-4 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60",
		cancel:
			"inline-flex h-11 items-center justify-center rounded-xl bg-muted px-4 font-medium text-foreground text-sm transition-colors hover:bg-muted/80",
	},
} as const;

export function SubscribeForm({
	statusPageId,
	className,
	variant = "default",
	mode = "card",
}: SubscribeFormProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [state, setState] = useState<SubscribeState>({
		error: "",
		success: "",
	});

	const styles = variantStyles[variant];

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		setIsPending(true);
		setState({ error: "", success: "" });

		try {
			const response = await fetch("/api/subscribe", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					statusPageId: formData.get("statusPageId"),
					email: formData.get("email"),
					slackWebhookUrl: formData.get("slackWebhookUrl"),
					discordWebhookUrl: formData.get("discordWebhookUrl"),
				}),
			});
			const result = (await response.json().catch(() => ({}))) as {
				error?: string;
			};

			if (!response.ok) {
				setState({
					error: result.error || "Unable to subscribe right now.",
					success: "",
				});
				return;
			}

			setState({
				error: "",
				success: "You're subscribed to status updates.",
			});
		} catch {
			setState({
				error: "Unable to subscribe right now.",
				success: "",
			});
		} finally {
			setIsPending(false);
		}
	};

	if (mode === "compact") {
		return (
			<div className={cn("relative", className)}>
				<button
					type="button"
					onClick={() => setIsOpen((open) => !open)}
					className={styles.trigger}
				>
					Subscribe
				</button>

				{isOpen ? (
					<div
						className={cn(
							"absolute top-full right-0 z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
							styles.panel,
						)}
					>
						<div className="border-border border-b px-6 py-5">
							<h2 className="font-semibold text-[1.375rem] text-foreground leading-none">
								Subscribe to Updates
							</h2>
							<p className="mt-3 text-muted-foreground text-sm">
								Get notified about incidents and maintenance for this status
								page.
							</p>
						</div>

						<form onSubmit={handleSubmit} className="px-6 py-5">
							<input type="hidden" name="statusPageId" value={statusPageId} />

							<div className="space-y-5">
								<div className="space-y-2">
									<label
										htmlFor={`status-subscribe-email-${variant}`}
										className="block font-medium text-foreground text-sm"
									>
										Email<span className="text-destructive">*</span>
									</label>
									<input
										id={`status-subscribe-email-${variant}`}
										type="email"
										name="email"
										placeholder="you@example.com"
										autoComplete="email"
										required
										disabled={isPending}
										className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
									/>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<label
											htmlFor={`status-subscribe-slack-${variant}`}
											className="block font-medium text-foreground text-sm"
										>
											Slack
										</label>
										<span className="text-muted-foreground text-sm">
											Optional
										</span>
									</div>
									<input
										id={`status-subscribe-slack-${variant}`}
										type="url"
										name="slackWebhookUrl"
										placeholder="https://hooks.slack.com/services/..."
										autoComplete="off"
										disabled={isPending}
										className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
									/>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<label
											htmlFor={`status-subscribe-discord-${variant}`}
											className="block font-medium text-foreground text-sm"
										>
											Discord
										</label>
										<span className="text-muted-foreground text-sm">
											Optional
										</span>
									</div>
									<input
										id={`status-subscribe-discord-${variant}`}
										type="url"
										name="discordWebhookUrl"
										placeholder="https://discord.com/api/webhooks/..."
										autoComplete="off"
										disabled={isPending}
										className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
									/>
								</div>

								{state.error ? (
									<p className="text-destructive text-sm">{state.error}</p>
								) : null}

								{state.success ? (
									<p className="flex items-center gap-2 text-green-600 text-sm dark:text-green-400">
										<FontAwesomeIcon icon={faCircleCheck} className="h-4 w-4" />
										{state.success}
									</p>
								) : null}
							</div>

							<div className="mt-6 flex items-center justify-between gap-3">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className={styles.cancel}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isPending}
									className={styles.button}
								>
									{isPending ? (
										<>
											<FontAwesomeIcon
												icon={faSpinner}
												className="mr-2 h-4 w-4 animate-spin"
											/>
											Subscribing...
										</>
									) : (
										"Subscribe"
									)}
								</button>
							</div>
						</form>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<section className={cn(styles.card, className)}>
			<form onSubmit={handleSubmit} className="space-y-4">
				<input type="hidden" name="statusPageId" value={statusPageId} />
				<input
					type="email"
					name="email"
					placeholder="you@example.com"
					autoComplete="email"
					required
					disabled={isPending}
					aria-label="Email address"
					className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
				/>
				<input
					type="url"
					name="slackWebhookUrl"
					placeholder="https://hooks.slack.com/services/..."
					autoComplete="off"
					disabled={isPending}
					aria-label="Slack webhook URL"
					className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
				/>
				<input
					type="url"
					name="discordWebhookUrl"
					placeholder="https://discord.com/api/webhooks/..."
					autoComplete="off"
					disabled={isPending}
					aria-label="Discord webhook URL"
					className="h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
				/>
				<button type="submit" disabled={isPending} className={styles.button}>
					{isPending ? (
						<>
							<FontAwesomeIcon
								icon={faSpinner}
								className="mr-2 h-4 w-4 animate-spin"
							/>
							Subscribing...
						</>
					) : (
						"Subscribe"
					)}
				</button>
				{state.error ? (
					<p className="text-destructive text-sm">{state.error}</p>
				) : null}
				{state.success ? (
					<p className="flex items-center gap-2 text-green-600 text-sm dark:text-green-400">
						<FontAwesomeIcon icon={faCircleCheck} className="h-4 w-4" />
						{state.success}
					</p>
				) : null}
			</form>
		</section>
	);
}
