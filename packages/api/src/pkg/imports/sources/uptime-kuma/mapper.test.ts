/** biome-ignore-all lint/style/noNonNullAssertion: test fixtures have known shapes */
import { describe, expect, it } from "vitest";
import { mapKumaMonitorList } from "./mapper";
import type { KumaMonitorList } from "./types";

function asList(monitors: Record<string, unknown>): KumaMonitorList {
    return monitors as KumaMonitorList;
}

describe("mapKumaMonitorList", () => {
    it("maps an http monitor with headers, status codes, and tls", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "Site",
                    type: "http",
                    url: "https://example.com",
                    method: "get",
                    ignoreTls: false,
                    accepted_statuscodes: ["200-299", "301"],
                    headers: '{"X-Token":"abc"}',
                    body: "",
                    interval: 60,
                    maxretries: 3,
                    retryInterval: 30,
                    timeout: 20,
                    tags: [],
                },
            }),
        );

        expect(result.skipped).toEqual([]);
        expect(result.monitors).toHaveLength(1);
        const m = result.monitors[0]!;
        expect(m.type).toBe("http");
        expect(m.sourceId).toBe("1");
        expect(m.config).toEqual({
            url: "https://example.com",
            method: "GET",
            headers: [{ key: "X-Token", value: "abc" }],
            body: "",
            acceptedStatusCodes: "200-299,301",
            checkSsl: true,
            sslCertExpiryNotificationDays: 30,
        });
        expect(m.interval).toBe(60);
        expect(m.retries).toBe(3);
        expect(m.retryInterval).toBe(30);
        expect(m.timeout).toBe(20);
    });

    it("maps keyword and json-query, flagging json-query with a warning", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "KW",
                    type: "keyword",
                    url: "https://example.com",
                    keyword: "ok",
                },
                "2": {
                    id: 2,
                    name: "JSON",
                    type: "json-query",
                    url: "https://api.example.com",
                    jsonPath: "$.status",
                },
            }),
        );

        const kw = result.monitors.find((m) => m.sourceId === "1")!;
        expect(kw.type).toBe("keyword");
        expect(kw.config.keyword).toBe("ok");

        const json = result.monitors.find((m) => m.sourceId === "2")!;
        expect(json.type).toBe("http-json");
        expect(json.config.jsonPath).toBe("$.status");
        expect(json.warnings?.length).toBeGreaterThan(0);
    });

    it("maps tcp (port), ping, and dns", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "TCP",
                    type: "port",
                    hostname: "h",
                    port: 5432,
                },
                "2": { id: 2, name: "PING", type: "ping", hostname: "h" },
                "3": {
                    id: 3,
                    name: "DNS",
                    type: "dns",
                    hostname: "example.com",
                    dns_resolve_server: "8.8.8.8",
                    dns_resolve_type: "AAAA",
                    port: 53,
                },
            }),
        );

        const tcp = result.monitors.find((m) => m.type === "tcp")!;
        expect(tcp.config).toEqual({ hostname: "h", port: 5432 });

        const ping = result.monitors.find((m) => m.type === "ping")!;
        expect(ping.config).toEqual({ hostname: "h" });

        const dns = result.monitors.find((m) => m.type === "dns")!;
        expect(dns.config).toEqual({
            hostname: "example.com",
            resolverServers: "8.8.8.8",
            port: 53,
            recordType: "AAAA",
            expectedValue: "",
        });
    });

    it("turns group monitors into groups with preserved nesting", () => {
        const result = mapKumaMonitorList(
            asList({
                "10": { id: 10, name: "Parent", type: "group", parent: null },
                "11": { id: 11, name: "Child", type: "group", parent: 10 },
                "1": {
                    id: 1,
                    name: "Site",
                    type: "http",
                    url: "https://x.com",
                    parent: 11,
                },
            }),
        );

        expect(result.groups).toEqual([
            { sourceId: "10", name: "Parent", sourceParentId: null },
            { sourceId: "11", name: "Child", sourceParentId: "10" },
        ]);
        expect(result.monitors[0]!.sourceGroupId).toBe("11");
    });

    it("collects tags and references them by name", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "Site",
                    type: "http",
                    url: "https://x.com",
                    tags: [
                        { name: "prod", color: "#ff0000", value: "ignored" },
                        { name: "prod", color: "#ff0000" },
                        { name: "edge", color: "#00ff00" },
                    ],
                },
            }),
        );

        expect(result.tags).toEqual([
            { name: "prod", color: "#ff0000" },
            { name: "edge", color: "#00ff00" },
        ]);
        expect(result.monitors[0]!.tagNames).toEqual(["prod", "edge"]);
    });

    it("skips unsupported types and tolerates bad headers", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": { id: 1, name: "Push", type: "push" },
                "2": {
                    id: 2,
                    name: "Bad headers",
                    type: "http",
                    url: "https://x.com",
                    headers: "not json",
                },
            }),
        );

        expect(result.skipped).toEqual([
            {
                sourceId: "1",
                name: "Push",
                type: "push",
                reason: "Unsupported monitor type",
            },
        ]);
        const http = result.monitors.find((m) => m.sourceId === "2")!;
        expect(http.config.headers).toEqual([]);
    });

    it("clamps timing to valid bounds and defaults missing values", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "Low",
                    type: "ping",
                    hostname: "h",
                    interval: 5,
                    maxretries: 99,
                },
            }),
        );

        const m = result.monitors[0]!;
        expect(m.interval).toBe(10);
        expect(m.retries).toBe(10);
        expect(m.retryInterval).toBe(10);
        expect(m.timeout).toBe(48);
    });

    it("caps retryInterval at the schema ceiling for long intervals", () => {
        const result = mapKumaMonitorList(
            asList({
                "1": {
                    id: 1,
                    name: "Long",
                    type: "ping",
                    hostname: "h",
                    interval: 600,
                    retryInterval: 600,
                },
            }),
        );

        const m = result.monitors[0]!;
        expect(m.interval).toBe(600);
        expect(m.retryInterval).toBe(300);
    });
});
