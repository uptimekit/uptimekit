"use client";

import { useSyncExternalStore } from "react";

export function LocalizedDateTime({
    value,
    format = "dateTime",
}: {
    value: Date | string;
    format?: "date" | "dateTime";
}) {
    const isoValue = new Date(value).toISOString();
    const label = useSyncExternalStore(
        () => () => {},
        () => {
            const date = new Date(value);
            return format === "date"
                ? date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                  })
                : date.toLocaleString();
        },
        () => isoValue,
    );

    return <time dateTime={isoValue}>{label}</time>;
}
