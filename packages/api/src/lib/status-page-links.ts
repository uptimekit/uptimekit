export const MAX_LINKED_STATUS_PAGES = 20;

/** Dedupes the ids, keeps their order, and drops the page linking to itself. */
export function normalizeLinkedStatusPageIds(
    linkedIds: string[],
    statusPageId: string,
) {
    return [...new Set(linkedIds)].filter((id) => id !== statusPageId);
}
