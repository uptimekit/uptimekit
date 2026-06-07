"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { Loader2, Shield } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const emptyForm = {
	clientId: "",
	clientSecret: "",
	discoveryUrl: "",
	domains: "",
	enabled: false,
	issuer: "",
	name: "",
	scopes: "openid email profile",
};

function splitList(value: string) {
	return Array.from(
		new Set(
			value
				.split(/[\s,]+/)
				.map((item) => item.trim())
				.filter(Boolean),
		),
	);
}

function joinList(value: string[]) {
	return value.join(" ");
}

export function OidcSettings() {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(emptyForm);
	const { data: provider, isLoading } = useQuery(
		orpc.organizations.getActiveOidcProvider.queryOptions(),
	);

	const callbackUrl = useMemo(() => {
		if (!provider?.callbackPath || typeof window === "undefined") {
			return "";
		}

		return `${window.location.origin}${provider.callbackPath}`;
	}, [provider?.callbackPath]);

	useEffect(() => {
		if (!provider) {
			setForm(emptyForm);
			return;
		}

		setForm({
			clientId: provider.clientId,
			clientSecret: "",
			discoveryUrl: provider.discoveryUrl,
			domains: joinList(provider.domains),
			enabled: provider.enabled,
			issuer: provider.issuer,
			name: provider.name,
			scopes: joinList(provider.scopes),
		});
	}, [provider]);

	const invalidateProvider = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.organizations.getActiveOidcProvider.key(),
		});
	};

	const upsertMutation = useMutation({
		mutationFn: async () =>
			client.organizations.upsertActiveOidcProvider({
				clientId: form.clientId.trim(),
				clientSecret: form.clientSecret.trim() || undefined,
				discoveryUrl: form.discoveryUrl.trim() || null,
				domains: splitList(form.domains),
				enabled: form.enabled,
				issuer: form.issuer.trim(),
				name: form.name.trim(),
				scopes: splitList(form.scopes),
			}),
		onSuccess: async () => {
			await invalidateProvider();
			setForm((current) => ({ ...current, clientSecret: "" }));
			sileo.success({ title: "Single sign-on updated" });
		},
		onError: (error: Error) => {
			sileo.error({
				title: error.message || "Failed to update single sign-on",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async () => client.organizations.deleteActiveOidcProvider(),
		onSuccess: async () => {
			await invalidateProvider();
			setForm(emptyForm);
			sileo.success({ title: "Single sign-on removed" });
		},
		onError: (error: Error) => {
			sileo.error({
				title: error.message || "Failed to remove single sign-on",
			});
		},
	});

	const canSave =
		form.name.trim().length >= 2 &&
		form.issuer.trim().length > 0 &&
		form.clientId.trim().length > 0 &&
		(provider?.clientSecretConfigured || form.clientSecret.trim().length > 0) &&
		splitList(form.domains).length > 0 &&
		splitList(form.scopes).length > 0;

	if (isLoading) {
		return (
			<div className="flex min-h-64 items-center justify-center text-muted-foreground">
				<Loader2 className="mr-2 size-4 animate-spin" />
				Loading single sign-on...
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<Shield className="size-5 text-muted-foreground" />
					<h2 className="font-semibold text-lg leading-none tracking-tight">
						Single Sign-On
					</h2>
				</div>
				<p className="text-muted-foreground text-sm">
					Configure the OIDC provider used for this organization's email
					domains.
				</p>
			</div>

			<Card className="md:col-span-2">
				<CardContent className="grid gap-6 p-6">
					<div className="flex items-center justify-between gap-4">
						<div>
							<Label htmlFor="oidc-enabled">OIDC sign-in</Label>
							<p className="text-muted-foreground text-sm">
								Enabled domains redirect to this provider after email entry.
							</p>
						</div>
						<Switch
							id="oidc-enabled"
							checked={form.enabled}
							onCheckedChange={(enabled) =>
								setForm((current) => ({ ...current, enabled }))
							}
						/>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="oidc-name">Provider name</Label>
							<Input
								id="oidc-name"
								value={form.name}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										name: event.target.value,
									}))
								}
								placeholder="Okta"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="oidc-client-id">Client ID</Label>
							<Input
								id="oidc-client-id"
								value={form.clientId}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										clientId: event.target.value,
									}))
								}
								placeholder="0oa..."
							/>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="oidc-issuer">Issuer URL</Label>
							<Input
								id="oidc-issuer"
								value={form.issuer}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										issuer: event.target.value,
									}))
								}
								placeholder="https://idp.example.com"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="oidc-discovery-url">Discovery URL</Label>
							<Input
								id="oidc-discovery-url"
								value={form.discoveryUrl}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										discoveryUrl: event.target.value,
									}))
								}
								placeholder="https://idp.example.com/.well-known/openid-configuration"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="oidc-client-secret">Client secret</Label>
						<Input
							id="oidc-client-secret"
							type="password"
							value={form.clientSecret}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									clientSecret: event.target.value,
								}))
							}
							placeholder={
								provider?.clientSecretConfigured
									? "Leave blank to keep current secret"
									: "Client secret"
							}
						/>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="oidc-domains">Email domains</Label>
							<Textarea
								id="oidc-domains"
								value={form.domains}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										domains: event.target.value,
									}))
								}
								placeholder="example.com"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="oidc-scopes">Scopes</Label>
							<Textarea
								id="oidc-scopes"
								value={form.scopes}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										scopes: event.target.value,
									}))
								}
								placeholder="openid email profile"
							/>
						</div>
					</div>

					{callbackUrl && (
						<div className="space-y-2">
							<Label htmlFor="oidc-callback-url">Callback URL</Label>
							<Input id="oidc-callback-url" value={callbackUrl} readOnly />
						</div>
					)}

					<div className="flex flex-wrap justify-end gap-3">
						{provider && (
							<Button
								type="button"
								variant="destructive"
								onClick={() => deleteMutation.mutate()}
								disabled={deleteMutation.isPending || upsertMutation.isPending}
							>
								{deleteMutation.isPending && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								Delete
							</Button>
						)}
						<Button
							type="button"
							onClick={() => upsertMutation.mutate()}
							disabled={!canSave || upsertMutation.isPending}
						>
							{upsertMutation.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Save
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
