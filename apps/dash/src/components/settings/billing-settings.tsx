"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function BillingSettings() {
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [isLoading, setIsLoading] = useState(false);
	const [activeSubscription, setActiveSubscription] = useState<boolean>(false);
	const [isYearly, setIsYearly] = useState(false);

	const handleCustomerPortal = async () => {
		setIsLoading(true);
		try {
			await authClient.customer.portal();
		} catch (e) {
			toast.error("Failed to redirect to portal");
		} finally {
			setIsLoading(false);
		}
	};

	const handleUpgrade = async () => {
		setIsLoading(true);
		try {
			const productId = isYearly
				? process.env.NEXT_PUBLIC_POLAR_PRO_YEARLY_ID
				: process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID;

			if (!productId) {
				toast.error("Product ID not configured");
				return;
			}

			const { data, error } = await authClient.checkout({
				products: [productId],
				successUrl: window.location.href,
				referenceId: activeOrg?.id,
			});

			if (error) {
				toast.error(error.message);
				return;
			}

			if (data?.url) {
				window.location.href = data.url;
			}
		} catch (e) {
			toast.error("Failed to redirect to checkout");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const checkSubscription = async () => {
			if (!activeOrg?.id) return;
			try {
				// @ts-expect-error - Polar client types inference
				const { data: orders } = await authClient.customer.subscriptions.list({
					query: {
						page: 1,
						limit: 10,
						active: true, // Only active subscriptions/orders
						referenceId: activeOrg.id, // Filter by organization ID
					},
				});
				// Assuming if there is at least one active order/subscription, the plan is Pro
				// @ts-expect-error
				const hasActiveSubscription = orders?.result?.items?.some(
					(order: any) =>
						order.status === "active" || order.status === "trialing",
				);

				setActiveSubscription(!!hasActiveSubscription);
			} catch (e) {
				console.error("Failed to fetch subscriptions", e);
			}
		};

		checkSubscription();
	}, [activeOrg?.id]);

	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
			<div className="space-y-2">
				<h2 className="font-semibold text-lg leading-none tracking-tight">
					Billing
				</h2>
				<p className="text-muted-foreground text-sm">
					Manage your billing information and subscription plan.
				</p>
			</div>

			<Card className="overflow-hidden pb-0 md:col-span-2">
				<CardHeader>
					<CardTitle>Overview</CardTitle>
					<CardDescription>
						View your current plan and manage your subscription.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<CreditCard className="h-5 w-5 text-primary" />
								</div>
								<div>
									<p className="font-medium text-sm">Current Plan</p>
									<p className="font-bold text-lg">
										{activeSubscription ? "Pro Plan" : "Free Plan"}
									</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-medium text-sm">Status</p>
								<p
									className={`font-medium text-sm ${activeSubscription ? "text-emerald-500" : "text-gray-500"}`}
								>
									{activeSubscription ? "Active" : "Inactive"}
								</p>
							</div>
						</div>
					</div>
				</CardContent>
				<CardFooter className="!pt-4 border-t bg-muted/50 px-6 py-4">
					<div className="flex w-full items-center justify-between">
						<p className="text-muted-foreground text-sm">
							{activeSubscription
								? "Manage your payment method and invoices."
								: "Upgrade to unlock more features."}
						</p>
						{activeSubscription ? (
							<Button
								variant="outline"
								onClick={handleCustomerPortal}
								disabled={isLoading}
							>
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Customer Portal
							</Button>
						) : (
							<Dialog>
								<DialogTrigger asChild>
									<Button disabled={isLoading}>
										{isLoading && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Upgrade
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Select Billing Cycle</DialogTitle>
										<DialogDescription>
											Choose the billing cycle that works best for you.
										</DialogDescription>
									</DialogHeader>
									<div className="grid gap-4 py-4">
										<div
											className={cn(
												"flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50",
												!isYearly &&
													"border-primary bg-primary/5 ring-1 ring-primary",
											)}
											onClick={() => setIsYearly(false)}
										>
											<div className="flex flex-col">
												<span className="font-medium">Monthly</span>
												<span className="text-muted-foreground text-sm">
													Pay monthly
												</span>
											</div>
										</div>
										<div
											className={cn(
												"flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50",
												isYearly &&
													"border-primary bg-primary/5 ring-1 ring-primary",
											)}
											onClick={() => setIsYearly(true)}
										>
											<div className="flex flex-col">
												<span className="font-medium">Yearly</span>
												<span className="text-muted-foreground text-sm">
													Pay yearly
												</span>
											</div>
											<Badge
												variant="secondary"
												className="bg-emerald-500/10 text-emerald-500"
											>
												3 months free
											</Badge>
										</div>
									</div>
									<DialogFooter>
										<Button
											className="w-full"
											onClick={handleUpgrade}
											disabled={isLoading}
										>
											{isLoading && (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											)}
											Continue to Checkout
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						)}
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
