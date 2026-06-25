import { z } from "zod";
import type { ImportSourceMeta } from "../../types";
import type { KumaConnection } from "./types";

export const KumaConnectionSchema = z.object({
    url: z.string().min(1, "URL is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    token: z.string().optional(),
});

export const uptimeKumaMeta: ImportSourceMeta<KumaConnection> = {
    id: "uptime-kuma",
    label: "Uptime Kuma",
    description:
        "Import monitors, groups, and tags from a self-hosted Uptime Kuma instance.",
    connectionSchema: KumaConnectionSchema,
};
