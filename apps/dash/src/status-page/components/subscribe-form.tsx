"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
    faCircleCheck,
    faEnvelope,
    faRss,
    faSpinner,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type FormEvent, useState } from "react";
import { getFeedLinks } from "@/status-page/lib/feed-links";
import { cn } from "@/status-page/lib/utils";

interface SubscribeFormProps {
    statusPageId: string;
    slug?: string;
    className?: string;
    variant?: "default" | "flat" | "signal" | "spark";
    allowEmailSubscriptions?: boolean;
}

interface SubscribeState {
    error: string;
    success: string;
}

const variantStyles = {
    default: {
        trigger:
            "inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 font-medium text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        button: "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60",
    },
    flat: {
        trigger:
            "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-4 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 dark:bg-muted dark:hover:bg-neutral-700!",
        button: "inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-4 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-60 dark:bg-muted dark:hover:bg-neutral-700!",
    },
    signal: {
        trigger:
            "signal-button inline-flex items-center justify-center rounded-lg px-3 py-1.5 font-medium text-[14px] text-foreground leading-5",
        button: "signal-button inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60",
    },
    spark: {
        trigger:
            "inline-flex h-9 items-center justify-center rounded-md bg-foreground px-3 font-medium text-background text-sm transition-colors hover:bg-foreground/90",
        button: "inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 font-medium text-background text-sm transition-colors hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-60",
    },
} as const;

export function SubscribeForm({
    statusPageId,
    slug,
    className,
    variant = "default",
    allowEmailSubscriptions = true,
}: SubscribeFormProps) {
    const [isPending, setIsPending] = useState(false);
    const [state, setState] = useState<SubscribeState>({
        error: "",
        success: "",
    });
    const styles = variantStyles[variant];
    const feedLinks = getFeedLinks(slug);
    const defaultTab = allowEmailSubscriptions ? "email" : "rss";

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
                    statusPageId,
                    email: formData.get("email"),
                    slackWebhookUrl: formData.get("slackWebhookUrl"),
                }),
            });
            if (!response.ok) {
                const result = (await response.json().catch(() => ({}))) as {
                    error?: string;
                };
                setState({
                    error: result.error || "Unable to subscribe right now.",
                    success: "",
                });
            } else {
                event.currentTarget.reset();
                setState({
                    error: "",
                    success: "You're subscribed to status updates.",
                });
            }
        } catch {
            setState({
                error: "Unable to subscribe right now.",
                success: "",
            });
        }
        setIsPending(false);
    };

    return (
        <DialogPrimitive.Root>
            <DialogPrimitive.Trigger className={cn(styles.trigger, className)}>
                Subscribe to updates
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto px-3 pt-[12vh] pb-6 sm:px-4">
                    <DialogPrimitive.Popup className="w-full max-w-[39rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0">
                        <div className="flex items-center justify-between border-border border-b px-4 py-4 sm:px-5">
                            <DialogPrimitive.Title className="font-semibold text-lg">
                                Subscribe to updates
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Close
                                aria-label="Close"
                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </DialogPrimitive.Close>
                        </div>

                        <TabsPrimitive.Root defaultValue={defaultTab}>
                            <TabsPrimitive.List className="mx-4 mt-4 flex border-border border-b text-muted-foreground sm:mx-5">
                                {allowEmailSubscriptions ? (
                                    <TabsPrimitive.Tab
                                        value="email"
                                        className="-mb-px inline-flex h-9 items-center gap-2 border-transparent border-b px-3 font-medium text-sm outline-none transition-colors hover:text-foreground data-active:border-foreground data-active:text-foreground"
                                    >
                                        <FontAwesomeIcon icon={faEnvelope} />
                                        Email
                                    </TabsPrimitive.Tab>
                                ) : null}
                                <TabsPrimitive.Tab
                                    value="rss"
                                    className="-mb-px inline-flex h-9 items-center gap-2 border-transparent border-b px-3 font-medium text-sm outline-none transition-colors hover:text-foreground data-active:border-foreground data-active:text-foreground"
                                >
                                    <FontAwesomeIcon icon={faRss} />
                                    RSS
                                </TabsPrimitive.Tab>
                                {allowEmailSubscriptions ? (
                                    <TabsPrimitive.Tab
                                        value="slack"
                                        className="-mb-px inline-flex h-9 items-center gap-2 border-transparent border-b px-3 font-medium text-sm outline-none transition-colors hover:text-foreground data-active:border-foreground data-active:text-foreground"
                                    >
                                        <span className="font-bold">#</span>
                                        Slack
                                    </TabsPrimitive.Tab>
                                ) : null}
                            </TabsPrimitive.List>

                            {allowEmailSubscriptions ? (
                                <TabsPrimitive.Panel value="email">
                                    <SubscribePanel
                                        id="email"
                                        isPending={isPending}
                                        onSubmit={handleSubmit}
                                        state={state}
                                        submitClassName={styles.button}
                                    />
                                </TabsPrimitive.Panel>
                            ) : null}

                            <TabsPrimitive.Panel value="rss">
                                <div className="space-y-4 px-4 py-5 sm:px-5">
                                    <p className="text-muted-foreground text-sm">
                                        Use a feed reader to follow incidents
                                        and maintenance updates.
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <FeedLink
                                            href={feedLinks.rss}
                                            label="RSS feed"
                                        />
                                        <FeedLink
                                            href={feedLinks.atom}
                                            label="Atom feed"
                                        />
                                    </div>
                                </div>
                            </TabsPrimitive.Panel>

                            {allowEmailSubscriptions ? (
                                <TabsPrimitive.Panel value="slack">
                                    <SubscribePanel
                                        id="slack"
                                        isPending={isPending}
                                        onSubmit={handleSubmit}
                                        state={state}
                                        submitClassName={styles.button}
                                        slack
                                    />
                                </TabsPrimitive.Panel>
                            ) : null}
                        </TabsPrimitive.Root>
                    </DialogPrimitive.Popup>
                </DialogPrimitive.Viewport>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function SubscribePanel({
    id,
    isPending,
    onSubmit,
    state,
    submitClassName,
    slack = false,
}: {
    id: string;
    isPending: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    state: SubscribeState;
    submitClassName: string;
    slack?: boolean;
}) {
    return (
        <form onSubmit={onSubmit}>
            <div className="space-y-4 px-4 py-5 sm:px-5">
                <div className="space-y-2">
                    <label
                        htmlFor={`status-subscribe-email-${id}`}
                        className="block font-medium text-sm"
                    >
                        Enter your email address
                    </label>
                    <input
                        id={`status-subscribe-email-${id}`}
                        type="email"
                        name="email"
                        placeholder="e.g. hello@example.com"
                        autoComplete="email"
                        required
                        disabled={isPending}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                    />
                </div>

                {slack ? (
                    <div className="space-y-2">
                        <label
                            htmlFor="status-subscribe-slack"
                            className="block font-medium text-sm"
                        >
                            Slack webhook URL
                        </label>
                        <input
                            id="status-subscribe-slack"
                            type="url"
                            name="slackWebhookUrl"
                            placeholder="https://hooks.slack.com/services/..."
                            autoComplete="off"
                            required
                            disabled={isPending}
                            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                        />
                    </div>
                ) : null}

                <div className="rounded-md bg-muted px-4 py-3 text-sm">
                    You&apos;ll receive emails for new incidents, as well as
                    updates to existing incidents.
                </div>

                {state.error ? (
                    <p className="text-destructive text-sm">{state.error}</p>
                ) : null}

                {state.success ? (
                    <p className="flex items-center gap-2 text-green-600 text-sm dark:text-green-400">
                        <FontAwesomeIcon
                            icon={faCircleCheck}
                            className="h-4 w-4"
                        />
                        {state.success}
                    </p>
                ) : null}
            </div>

            <div className="flex justify-end border-border border-t px-4 py-4 sm:px-5">
                <button
                    type="submit"
                    disabled={isPending}
                    className={submitClassName}
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
    );
}

function FeedLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-background px-4 py-3 font-medium text-sm transition-colors hover:bg-muted"
        >
            {label}
        </a>
    );
}
