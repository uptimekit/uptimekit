interface MonitorNameInput {
    name: string;
    displayName?: string | null;
}

/**
 * Resolve the name a monitor is shown under on a specific status page.
 *
 * A status page can override a monitor's name for its own audience, so the same
 * monitor may appear as "Checkout API" on an internal page and as "Payments" on
 * the public one. Blank or whitespace-only overrides fall back to the monitor's
 * real name so a label is never empty.
 *
 * @param monitor - The monitor's real `name` plus the optional per-page override.
 * @returns The trimmed override when one is set, otherwise the real name.
 */
export function resolveMonitorDisplayName(monitor: MonitorNameInput): string {
    return monitor.displayName?.trim() || monitor.name;
}

/**
 * Report whether a status page renames this monitor.
 *
 * @param monitor - The monitor's real `name` plus the optional per-page override.
 * @returns `true` when the resolved name differs from the monitor's real name.
 */
export function hasMonitorDisplayNameOverride(
    monitor: MonitorNameInput,
): boolean {
    return resolveMonitorDisplayName(monitor) !== monitor.name;
}

/**
 * Normalize a display name override for storage.
 *
 * @param displayName - Raw user input from the status page structure editor.
 * @returns The trimmed override, or `null` when it is empty or matches nothing.
 */
export function normalizeMonitorDisplayName(
    displayName: string | null | undefined,
): string | null {
    return displayName?.trim() || null;
}
