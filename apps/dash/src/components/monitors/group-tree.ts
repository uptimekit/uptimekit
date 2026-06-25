export interface GroupNodeInput {
    id: string;
    name: string;
    parentId?: string | null;
}

export interface GroupWithPath<T extends GroupNodeInput> {
    group: T;
    path: string;
    depth: number;
}

export interface GroupTreeNode<T extends GroupNodeInput> {
    group: T;
    depth: number;
    children: GroupTreeNode<T>[];
}

export const GROUP_PATH_SEPARATOR = " / ";

export const NONE_SELECT_VALUE = "__none__";
export const NO_PARENT_LABEL = "No parent (top level)";
export const NO_GROUP_LABEL = "No group";

export function resolveGroupPathLabel<T extends GroupNodeInput>(
    value: string,
    groupPaths: GroupWithPath<T>[],
    fallback: string = NO_PARENT_LABEL,
): string {
    if (value === NONE_SELECT_VALUE) return fallback;
    return groupPaths.find(({ group }) => group.id === value)?.path ?? fallback;
}

function resolveGroupPath<T extends GroupNodeInput>(
    group: T,
    byId: Map<string, T>,
): { path: string; depth: number } {
    const names: string[] = [];
    const seen = new Set<string>();

    let current: T | undefined = group;
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        names.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    return { path: names.join(GROUP_PATH_SEPARATOR), depth: names.length - 1 };
}

export function buildGroupPaths<T extends GroupNodeInput>(
    groups: T[] | undefined | null,
): GroupWithPath<T>[] {
    if (!groups || groups.length === 0) return [];

    const byId = new Map(groups.map((group) => [group.id, group]));

    return groups
        .map((group) => ({ group, ...resolveGroupPath(group, byId) }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

export function buildGroupTree<T extends GroupNodeInput>(
    groups: T[] | undefined | null,
): GroupTreeNode<T>[] {
    if (!groups || groups.length === 0) return [];

    const byId = new Map(groups.map((group) => [group.id, group]));
    const childrenByParent = new Map<string, T[]>();
    const roots: T[] = [];

    for (const group of groups) {
        const parentId = group.parentId;
        if (parentId && byId.has(parentId)) {
            const siblings = childrenByParent.get(parentId) ?? [];
            siblings.push(group);
            childrenByParent.set(parentId, siblings);
        } else {
            roots.push(group);
        }
    }

    const sortByName = (a: T, b: T) => a.name.localeCompare(b.name);

    const toNode = (group: T, depth: number): GroupTreeNode<T> => ({
        group,
        depth,
        children: (childrenByParent.get(group.id) ?? [])
            .sort(sortByName)
            .map((child) => toNode(child, depth + 1)),
    });

    return roots.sort(sortByName).map((root) => toNode(root, 0));
}

export function getGroupAndDescendantIds<T extends GroupNodeInput>(
    rootId: string,
    groups: T[] | undefined | null,
): Set<string> {
    const result = new Set<string>();
    if (!groups || groups.length === 0) return result;

    const childrenByParent = new Map<string, string[]>();
    for (const group of groups) {
        if (!group.parentId) continue;
        const siblings = childrenByParent.get(group.parentId) ?? [];
        siblings.push(group.id);
        childrenByParent.set(group.parentId, siblings);
    }

    const stack = [rootId];
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined || result.has(current)) continue;
        result.add(current);
        const children = childrenByParent.get(current);
        if (children) stack.push(...children);
    }

    return result;
}
