import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin, DedupeRequestsPlugin } from "@orpc/client/plugins";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "@uptimekit/api/routers/index";
import { sileo } from "sileo";

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error) => {
            sileo.action({
                title: `Error: ${error.message}`,
                button: {
                    title: "Retry",
                    onClick: () => {
                        queryClient.invalidateQueries();
                    },
                },
            });
        },
    }),
});

export const link = new RPCLink({
    url: () =>
        `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/rpc`,
    fetch(url, options) {
        return fetch(url, {
            ...options,
            credentials: "include",
        });
    },
    headers: async () => {
        if (typeof window !== "undefined") {
            return {};
        }

        const { headers } = await import("next/headers");
        return Object.fromEntries(await headers());
    },
    plugins: [
        new DedupeRequestsPlugin({
            filter: ({ request }) => request.method === "GET", // Filters requests to dedupe
            groups: [
                {
                    condition: () => true,
                    context: {}, // Context used for the rest of the request lifecycle
                },
            ],
        }),
        new BatchLinkPlugin({
            groups: [
                {
                    condition: (options) => true,
                    context: {}, // Context used for the rest of the request lifecycle
                },
            ],
        }),
    ],
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
