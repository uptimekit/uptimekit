import { z } from "zod";
import packageJson from "../../../../package.json";
import { publicProcedure } from "../index";
import { createLogger } from "../lib/logger";

const logger = createLogger("VERSION");

const GITHUB_TAGS_URL =
    "https://api.github.com/repos/uptimekit/uptimekit/tags?per_page=100";
const VERSION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const VERSION_LOOKUP_FAILURE_TTL_MS = 15 * 60 * 1000;

const githubTagsSchema = z.array(
    z.object({
        name: z.string(),
    }),
);

const versionOutputSchema = z.object({
    version: z.string(),
    latestVersion: z.string().nullable(),
    isLatest: z.boolean().nullable(),
});

type VersionOutput = z.infer<typeof versionOutputSchema>;

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    version: string;
}

interface VersionCacheEntry {
    value: VersionOutput;
    expiresAt: number;
}

let versionCache: VersionCacheEntry | null = null;
let pendingVersionLookup: Promise<VersionOutput> | null = null;

export const getVersion = publicProcedure
    .route({
        method: "GET",
        path: "/version",
        tags: ["System"],
        summary: "Get version",
        description:
            "Retrieve the UptimeKit version and compare it with the latest stable GitHub tag.",
    })
    .output(versionOutputSchema)
    .handler(async () => getVersionInfo());

export async function getVersionInfo(now = Date.now()): Promise<VersionOutput> {
    if (versionCache && versionCache.expiresAt > now) {
        return versionCache.value;
    }

    if (!pendingVersionLookup) {
        pendingVersionLookup = refreshVersionInfo(now).finally(() => {
            pendingVersionLookup = null;
        });
    }

    return pendingVersionLookup;
}

export function invalidateVersionCache() {
    versionCache = null;
    pendingVersionLookup = null;
}

async function refreshVersionInfo(now: number): Promise<VersionOutput> {
    try {
        const latestVersion = await fetchLatestStableVersion();
        const value = buildVersionOutput(packageJson.version, latestVersion);

        versionCache = {
            value,
            expiresAt: now + VERSION_CACHE_TTL_MS,
        };

        return value;
    } catch (error) {
        logger.warn("Failed to check latest version", error);

        const value =
            versionCache?.value ?? buildVersionOutput(packageJson.version);
        versionCache = {
            value,
            expiresAt: now + VERSION_LOOKUP_FAILURE_TTL_MS,
        };

        return value;
    }
}

async function fetchLatestStableVersion(): Promise<string | null> {
    const response = await fetch(GITHUB_TAGS_URL, {
        headers: getGitHubHeaders(),
    });

    if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
    }

    const tags = githubTagsSchema.parse(await response.json());
    const stableVersions = tags
        .map((tag) => parseStableVersion(tag.name))
        .filter((version): version is ParsedVersion => version !== null);

    if (stableVersions.length === 0) {
        return null;
    }

    const [latestVersion] = stableVersions.sort((a, b) =>
        compareParsedVersions(b, a),
    );

    return latestVersion?.version ?? null;
}

function buildVersionOutput(
    version: string,
    latestVersion: string | null = null,
): VersionOutput {
    return {
        version,
        latestVersion,
        isLatest: latestVersion
            ? compareVersions(version, latestVersion) >= 0
            : null,
    };
}

function getGitHubHeaders() {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "UptimeKit-Version-Check",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GITHUB_TOKEN?.trim();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function parseStableVersion(value: string): ParsedVersion | null {
    const match =
        /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(
            value,
        );

    if (!match) {
        return null;
    }

    const [, major, minor, patch] = match;

    if (major === undefined || minor === undefined || patch === undefined) {
        return null;
    }

    return {
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        version: `${major}.${minor}.${patch}`,
    };
}

function compareVersions(currentVersion: string, latestVersion: string) {
    const current = parseStableVersion(currentVersion);
    const latest = parseStableVersion(latestVersion);

    if (!current || !latest) {
        return currentVersion.localeCompare(latestVersion);
    }

    return compareParsedVersions(current, latest);
}

function compareParsedVersions(a: ParsedVersion, b: ParsedVersion) {
    if (a.major !== b.major) {
        return a.major - b.major;
    }

    if (a.minor !== b.minor) {
        return a.minor - b.minor;
    }

    return a.patch - b.patch;
}
