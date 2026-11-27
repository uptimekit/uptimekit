import { db } from "@uptimekit/db";
import { statusPage, statusPageLink } from "@uptimekit/db/schema/status-pages";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getStatusPageUrl } from "@/lib/status-page-url";
import type { LinkedStatusPage } from "@/status-page/themes/types";
import { isStatusPagePubliclyAccessible } from "./access-check";
import { getStatusPageData } from "./data-preparer";
import { getStatusPageBySlug, type StatusPageRecord } from "./db-queries";
import { createTtlCache } from "./ttl-cache";

// Same TTL as the page data: every public view loads these, and traffic peaks during outages
const linkedPagesCache = createTtlCache<LinkedStatusPage[]>({
    ttlMs: 15_000,
    maxEntries: 500,
});

function getLinkedPageUrl(page: StatusPageRecord) {
    // /status/<slug> resolves on the dashboard host and on status page hosts alike
    return page.domain ? getStatusPageUrl(page) : `/status/${page.slug}`;
}

async function toLinkedStatusPage(
    page: StatusPageRecord,
): Promise<LinkedStatusPage> {
    let status: LinkedStatusPage["status"] = null;
    try {
        // Same cached computation the linked page renders with, so the status shown here matches it
        status = isStatusPagePubliclyAccessible(page)
            ? (await getStatusPageData(page)).overallStatus
            : null;
    } catch (error) {
        console.error(`Linked status page ${page.id} status error:`, error);
        status = "unknown";
    }

    return {
        id: page.id,
        name: page.name,
        url: getLinkedPageUrl(page),
        status,
    };
}

async function loadLinkedStatusPages(
    statusPageId: string,
): Promise<LinkedStatusPage[]> {
    const source = alias(statusPage, "source_status_page");
    const linked = await db
        .select({ slug: statusPage.slug })
        .from(statusPageLink)
        .innerJoin(source, eq(source.id, statusPageLink.statusPageId))
        .innerJoin(
            statusPage,
            and(
                eq(statusPage.id, statusPageLink.linkedStatusPageId),
                eq(statusPage.organizationId, source.organizationId),
            ),
        )
        .where(eq(statusPageLink.statusPageId, statusPageId))
        .orderBy(asc(statusPageLink.order));

    const records = await Promise.all(
        linked.map(({ slug }) => getStatusPageBySlug(slug)),
    );

    return Promise.all(
        records
            .filter((page): page is StatusPageRecord => Boolean(page))
            .map(toLinkedStatusPage),
    );
}

/** Never throws: a broken linked page must not take down the page linking to it. */
export async function getLinkedStatusPages(
    statusPageId: string,
): Promise<LinkedStatusPage[]> {
    try {
        return await linkedPagesCache.get(statusPageId, () =>
            loadLinkedStatusPages(statusPageId),
        );
    } catch (error) {
        console.error("Linked status pages error:", error);
        return [];
    }
}
