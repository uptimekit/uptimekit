import type { Incident } from "@/themes/types";
import { canAccessStatusPage } from "./access-check";
import { getFeedLinks } from "./feed-links";
import { getHostFromHeaders, getProtocolFromHeaders } from "./route-utils";
import { prepareUpdatesPageData } from "./subpage-data-preparer";

type FeedFormat = "rss" | "atom";

interface StatusPageConfig {
    id: string;
    name: string;
    description?: string | null;
    public: boolean;
    password: string | null;
}

interface FeedOptions {
    request: Request;
    pageConfig: StatusPageConfig;
    routeSlug?: string;
    format: FeedFormat;
}

export function feedNotFound() {
    return new Response("Not found", { status: 404 });
}

export async function renderStatusFeed({
    request,
    pageConfig,
    routeSlug,
    format,
}: FeedOptions) {
    if (!(await canAccessStatusPage(pageConfig))) {
        return feedNotFound();
    }

    const data = await prepareUpdatesPageData(pageConfig, "all", routeSlug);
    const origin = getRequestOrigin(request);
    const links = getFeedLinks(routeSlug);
    const pageUrl = absoluteUrl(routeSlug ? `/${routeSlug}` : "/", origin);
    const feedUrl = absoluteUrl(
        format === "rss" ? links.rss : links.atom,
        origin,
    );
    const items = [...data.activeIssues, ...data.allUpdates].sort(
        (a, b) => getItemDate(b).getTime() - getItemDate(a).getTime(),
    );
    const xml =
        format === "rss"
            ? buildRssFeed({ data, items, pageUrl })
            : buildAtomFeed({ data, feedUrl, items, pageUrl });

    return new Response(xml, {
        headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
            "Content-Type": `application/${format === "rss" ? "rss" : "atom"}+xml; charset=utf-8`,
        },
    });
}

function buildRssFeed({
    data,
    items,
    pageUrl,
}: {
    data: Awaited<ReturnType<typeof prepareUpdatesPageData>>;
    items: Incident[];
    pageUrl: string;
}) {
    const title = `${data.config.name} Status Updates`;
    const description = `Incident and maintenance updates for ${data.config.name}.`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <description>${escapeXml(description)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map((item) => buildRssItem(item, pageUrl)).join("\n")}
  </channel>
</rss>`;
}

function buildRssItem(item: Incident, pageUrl: string) {
    const link = absoluteUrl(item.detailsLink, pageUrl);

    return `    <item>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(getItemSummary(item))}</description>
      <pubDate>${getItemDate(item).toUTCString()}</pubDate>
    </item>`;
}

function buildAtomFeed({
    data,
    feedUrl,
    items,
    pageUrl,
}: {
    data: Awaited<ReturnType<typeof prepareUpdatesPageData>>;
    feedUrl: string;
    items: Incident[];
    pageUrl: string;
}) {
    const title = `${data.config.name} Status Updates`;
    const updated = items[0] ? getItemDate(items[0]) : new Date();

    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(pageUrl)}</id>
  <title>${escapeXml(title)}</title>
  <link href="${escapeXml(pageUrl)}" />
  <link rel="self" href="${escapeXml(feedUrl)}" />
  <updated>${updated.toISOString()}</updated>
${items.map((item) => buildAtomEntry(item, pageUrl)).join("\n")}
</feed>`;
}

function buildAtomEntry(item: Incident, pageUrl: string) {
    const link = absoluteUrl(item.detailsLink, pageUrl);
    const updated = getItemDate(item);

    return `  <entry>
    <id>${escapeXml(link)}</id>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(link)}" />
    <published>${new Date(item.startedAt).toISOString()}</published>
    <updated>${updated.toISOString()}</updated>
    <summary>${escapeXml(getItemSummary(item))}</summary>
  </entry>`;
}

function getItemDate(item: Incident) {
    const latestActivity = item.activities.reduce(
        (latest, activity) =>
            Math.max(latest, new Date(activity.createdAt).getTime()),
        0,
    );

    return new Date(latestActivity || item.endedAt || item.startedAt);
}

function getItemSummary(item: Incident) {
    const latestMessage = item.activities[0]?.message;
    const monitors = item.monitors
        .flatMap(({ monitor }) => (monitor.name ? [monitor.name] : []))
        .join(", ");

    return [latestMessage, monitors ? `Affected components: ${monitors}` : ""]
        .filter(Boolean)
        .join("\n\n");
}

function getRequestOrigin(request: Request) {
    const host = getHostFromHeaders(request.headers);

    if (!host) {
        return new URL(request.url).origin;
    }

    return `${getProtocolFromHeaders(request.headers)}://${host}`;
}

function absoluteUrl(path: string, origin: string) {
    return new URL(path, origin).toString();
}

function escapeXml(value: string) {
    return value.replace(/[<>&'"]/g, (char) => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case "'":
                return "&apos;";
            default:
                return "&quot;";
        }
    });
}
