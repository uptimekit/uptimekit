"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KumaConnectionValues } from "./uptime-kuma-connection";

export function UptimeKumaConnectionForm({
    values,
    onChange,
}: {
    values: KumaConnectionValues;
    onChange: (next: KumaConnectionValues) => void;
}) {
    const set = (patch: Partial<KumaConnectionValues>) =>
        onChange({ ...values, ...patch });

    return (
        <div className="grid gap-4">
            <div className="space-y-2">
                <Label htmlFor="kuma-url">Uptime Kuma URL</Label>
                <Input
                    id="kuma-url"
                    placeholder="https://kuma.example.com"
                    value={values.url}
                    onChange={(e) => set({ url: e.target.value })}
                />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="kuma-username">Username</Label>
                    <Input
                        id="kuma-username"
                        value={values.username}
                        onChange={(e) => set({ username: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="kuma-password">Password</Label>
                    <Input
                        id="kuma-password"
                        type="password"
                        value={values.password}
                        onChange={(e) => set({ password: e.target.value })}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="kuma-token">2FA token (optional)</Label>
                <Input
                    id="kuma-token"
                    value={values.token}
                    onChange={(e) => set({ token: e.target.value })}
                />
            </div>
        </div>
    );
}
