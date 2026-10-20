export function getFeedLinks(slug?: string) {
    const basePath = slug ? `/${slug}` : "";

    return {
        rss: `${basePath}/rss.xml`,
        atom: `${basePath}/atom.xml`,
        json: `${basePath}/summary.json`,
    };
}

export function getFeedAlternates(slug?: string) {
    const links = getFeedLinks(slug);

    return {
        "application/rss+xml": links.rss,
        "application/atom+xml": links.atom,
        "application/json": links.json,
    };
}
