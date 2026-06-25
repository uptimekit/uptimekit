import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../../../package.json";
import { getVersionInfo, invalidateVersionCache } from "./version";

function mockGitHubTags(tags: string[]) {
    const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify(tags.map((name) => ({ name }))), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
}

describe("version router", () => {
    beforeEach(() => {
        invalidateVersionCache();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        invalidateVersionCache();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("returns the latest stable GitHub tag and caches the result", async () => {
        const fetchMock = mockGitHubTags([
            "v998.0.0",
            "v999.0.0-beta.1",
            "v0.0.1",
        ]);

        await expect(getVersionInfo(1000)).resolves.toEqual({
            version: packageJson.version,
            latestVersion: "998.0.0",
            isLatest: false,
        });
        await getVersionInfo(1001);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("deduplicates concurrent cache misses", async () => {
        let resolveResponse: (response: Response) => void = () => undefined;
        const responsePromise = new Promise<Response>((resolve) => {
            resolveResponse = resolve;
        });
        const fetchMock = vi.fn(() => responsePromise);

        vi.stubGlobal("fetch", fetchMock);

        const firstResult = getVersionInfo(1000);
        const secondResult = getVersionInfo(1000);

        resolveResponse(
            new Response(JSON.stringify([{ name: "v998.0.0" }]), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );

        await expect(Promise.all([firstResult, secondResult])).resolves.toEqual(
            [
                {
                    version: packageJson.version,
                    latestVersion: "998.0.0",
                    isLatest: false,
                },
                {
                    version: packageJson.version,
                    latestVersion: "998.0.0",
                    isLatest: false,
                },
            ],
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("caches lookup failures with an unknown latest status", async () => {
        const fetchMock = vi.fn(async () => {
            return new Response("rate limited", { status: 403 });
        });

        vi.stubGlobal("fetch", fetchMock);

        await expect(getVersionInfo(1000)).resolves.toEqual({
            version: packageJson.version,
            latestVersion: null,
            isLatest: null,
        });
        await getVersionInfo(1001);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
