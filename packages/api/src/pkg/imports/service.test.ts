import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    commitImport,
    computeQuotaRemaining,
    orderGroupsByDependency,
    selectNeededGroups,
} from "./service";
import type { ImportedGroup, ImportedMonitor } from "./types";

function unlimitedQuota() {
    return {
        organizationId: "org-1",
        activeMonitorLimit: null as number | null,
        regionsPerMonitorLimit: null as number | null,
        activeMonitorCount: 0,
        totalMonitorCount: 0,
    };
}

const mocks = vi.hoisted(() => ({
    insertedGroups: [] as Array<Record<string, unknown>>,
    insertedTags: [] as Array<Record<string, unknown>>,
    insertMonitorCalls: [] as Array<Record<string, unknown>>,
    existingTags: [] as Array<{ id: string; name: string }>,
    workers: [] as Array<{ id: string; location: string }>,
    notifications: [] as Array<{ id: string }>,
    quotaState: {
        organizationId: "org-1",
        activeMonitorLimit: null as number | null,
        regionsPerMonitorLimit: null as number | null,
        activeMonitorCount: 0,
        totalMonitorCount: 0,
    },
}));

vi.mock("@uptimekit/db", () => {
    const tx = {
        insert: () => ({
            values: async (vals: Record<string, unknown>) => {
                if (Array.isArray(vals)) return;
                if ("color" in vals) mocks.insertedTags.push(vals);
                else if ("parentId" in vals) mocks.insertedGroups.push(vals);
            },
        }),
        select: () => ({
            from: () => ({ where: async () => mocks.existingTags }),
        }),
    };

    return {
        db: {
            query: {
                organization: { findFirst: async () => ({ id: "org-1" }) },
            },
            // The worker query selects a `location` column; the notification query doesn't.
            select: (columns: Record<string, unknown>) => ({
                from: () => ({
                    where: async () =>
                        "location" in columns
                            ? mocks.workers
                            : mocks.notifications,
                }),
            }),
            transaction: async (
                cb: (tx: unknown) => Promise<unknown>,
            ): Promise<unknown> => cb(tx),
        },
    };
});

vi.mock("../../lib/organization-limits", () => ({
    getOrganizationQuotaState: async () => mocks.quotaState,
}));

vi.mock("../../lib/insert-monitor", () => ({
    insertMonitor: async (_tx: unknown, input: Record<string, unknown>) => {
        mocks.insertMonitorCalls.push(input);
        return { id: `monitor-${mocks.insertMonitorCalls.length}` };
    },
}));

function buildMonitor(
    overrides: Partial<ImportedMonitor> = {},
): ImportedMonitor {
    return {
        sourceId: "m",
        name: "Monitor",
        type: "http",
        interval: 60,
        timeout: 48,
        retries: 2,
        retryInterval: 20,
        config: {},
        sourceGroupId: null,
        tagNames: [],
        ...overrides,
    };
}

describe("orderGroupsByDependency", () => {
    it("returns parents before children", () => {
        const groups: ImportedGroup[] = [
            { sourceId: "c", name: "C", sourceParentId: "b" },
            { sourceId: "a", name: "A", sourceParentId: null },
            { sourceId: "b", name: "B", sourceParentId: "a" },
        ];
        expect(orderGroupsByDependency(groups).map((g) => g.sourceId)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("treats parents missing from the set as roots", () => {
        const groups: ImportedGroup[] = [
            { sourceId: "x", name: "X", sourceParentId: "missing" },
        ];
        expect(orderGroupsByDependency(groups).map((g) => g.sourceId)).toEqual([
            "x",
        ]);
    });
});

describe("selectNeededGroups", () => {
    const groups: ImportedGroup[] = [
        { sourceId: "root", name: "Root", sourceParentId: null },
        { sourceId: "mid", name: "Mid", sourceParentId: "root" },
        { sourceId: "leaf", name: "Leaf", sourceParentId: "mid" },
        { sourceId: "other", name: "Other", sourceParentId: null },
    ];

    it("includes a monitor's group and all of its ancestors", () => {
        const result = selectNeededGroups(groups, ["leaf"]);
        expect(result.map((g) => g.sourceId).sort()).toEqual([
            "leaf",
            "mid",
            "root",
        ]);
    });

    it("drops groups unrelated to any committed monitor", () => {
        const result = selectNeededGroups(groups, ["mid"]);
        expect(result.map((g) => g.sourceId).sort()).toEqual(["mid", "root"]);
        expect(result.some((g) => g.sourceId === "other")).toBe(false);
    });

    it("returns nothing when no monitors reference a group", () => {
        expect(selectNeededGroups(groups, [null, undefined])).toEqual([]);
    });

    it("dedupes shared ancestors across multiple monitors", () => {
        const result = selectNeededGroups(groups, ["leaf", "leaf", "mid"]);
        const ids = result.map((g) => g.sourceId);
        expect(ids.sort()).toEqual(["leaf", "mid", "root"]);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("computeQuotaRemaining", () => {
    it("returns null remaining for an unlimited org", () => {
        expect(computeQuotaRemaining(null, 5)).toBeNull();
    });

    it("computes remaining and never goes negative", () => {
        expect(computeQuotaRemaining(10, 3)).toBe(7);
        expect(computeQuotaRemaining(2, 5)).toBe(0);
    });
});

describe("commitImport", () => {
    beforeEach(() => {
        mocks.insertedGroups.length = 0;
        mocks.insertedTags.length = 0;
        mocks.insertMonitorCalls.length = 0;
        mocks.existingTags = [];
        mocks.workers = [];
        mocks.notifications = [];
        mocks.quotaState = unlimitedQuota();
    });

    it("creates a group whose parent isn't in the set as a root", async () => {
        const result = await commitImport({
            organizationId: "org-1",
            workerIds: [],
            notificationIds: [],
            monitors: [
                buildMonitor({ sourceId: "m1", sourceGroupId: "child" }),
            ],
            groups: [
                { sourceId: "child", name: "Child", sourceParentId: "missing" },
            ],
            tags: [],
        });

        expect(result.groupsCreated).toBe(1);
        expect(mocks.insertedGroups).toHaveLength(1);
        expect(mocks.insertedGroups[0]?.name).toBe("Child");
        expect(mocks.insertedGroups[0]?.parentId).toBeNull();

        expect(mocks.insertMonitorCalls[0]?.groupId).toBe(
            mocks.insertedGroups[0]?.id,
        );
    });

    it("chains parent ids for nested groups", async () => {
        await commitImport({
            organizationId: "org-1",
            workerIds: [],
            notificationIds: [],
            monitors: [buildMonitor({ sourceId: "m1", sourceGroupId: "leaf" })],
            groups: [
                { sourceId: "leaf", name: "Leaf", sourceParentId: "root" },
                { sourceId: "root", name: "Root", sourceParentId: null },
            ],
            tags: [],
        });

        const root = mocks.insertedGroups.find((g) => g.name === "Root");
        const leaf = mocks.insertedGroups.find((g) => g.name === "Leaf");
        expect(root?.parentId).toBeNull();
        expect(leaf?.parentId).toBe(root?.id);
    });

    it("reuses existing org tags and only creates referenced new ones", async () => {
        mocks.existingTags = [{ id: "tag-prod", name: "prod" }];

        const result = await commitImport({
            organizationId: "org-1",
            workerIds: [],
            notificationIds: [],
            monitors: [
                buildMonitor({ sourceId: "m1", tagNames: ["prod", "edge"] }),
            ],
            groups: [],
            tags: [
                { name: "prod", color: "#ff0000" },
                { name: "edge", color: "#00ff00" },
                { name: "unused", color: "#0000ff" },
            ],
        });

        expect(mocks.insertedTags.map((t) => t.name)).toEqual(["edge"]);
        expect(result.tagsCreated).toBe(1);

        const tagIds = mocks.insertMonitorCalls[0]?.tagIds as string[];
        expect(tagIds).toContain("tag-prod");
        expect(tagIds).toHaveLength(2);
    });

    it("rejects when a selected worker is missing or inactive", async () => {
        mocks.workers = []; // requested worker is not returned (missing/inactive)
        await expect(
            commitImport({
                organizationId: "org-1",
                workerIds: ["w1"],
                notificationIds: [],
                monitors: [buildMonitor()],
                groups: [],
                tags: [],
            }),
        ).rejects.toThrow(/workers are missing or inactive/);
    });

    it("rejects when a selected notification is missing or inactive", async () => {
        mocks.notifications = []; // requested notification is not returned
        await expect(
            commitImport({
                organizationId: "org-1",
                workerIds: [],
                notificationIds: ["n1"],
                monitors: [buildMonitor()],
                groups: [],
                tags: [],
            }),
        ).rejects.toThrow(/notifications are missing or inactive/);
    });

    it("rejects when worker count exceeds the region limit", async () => {
        mocks.workers = [
            { id: "w1", location: "a" },
            { id: "w2", location: "b" },
        ];
        mocks.quotaState.regionsPerMonitorLimit = 1;
        await expect(
            commitImport({
                organizationId: "org-1",
                workerIds: ["w1", "w2"],
                notificationIds: [],
                monitors: [buildMonitor()],
                groups: [],
                tags: [],
            }),
        ).rejects.toThrow(/region/);
    });

    it("rejects when the active monitor limit would be exceeded", async () => {
        mocks.workers = [{ id: "w1", location: "a" }];
        mocks.quotaState.activeMonitorLimit = 1;
        mocks.quotaState.activeMonitorCount = 1; // remaining 0
        await expect(
            commitImport({
                organizationId: "org-1",
                workerIds: ["w1"],
                notificationIds: [],
                monitors: [buildMonitor()],
                groups: [],
                tags: [],
            }),
        ).rejects.toThrow(/active monitor limit/);
    });
});
