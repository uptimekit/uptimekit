"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/status-page/lib/utils";
import type { ViewportTooltipPosition } from "./viewport-tooltip-position";

export function ViewportTooltip({
    children,
    className,
    edgePadding = "8rem",
    position,
}: {
    children: ReactNode;
    className?: string;
    edgePadding?: string;
    position: ViewportTooltipPosition;
}) {
    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            className={cn(
                "pointer-events-none fixed z-50 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-full",
                className,
            )}
            style={{
                left: `clamp(${edgePadding}, ${position.left}px, calc(100vw - ${edgePadding}))`,
                top: position.top,
            }}
        >
            {children}
        </div>,
        document.body,
    );
}
