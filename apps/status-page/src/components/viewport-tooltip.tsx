"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ViewportTooltipPosition {
    left: number;
    top: number;
}

const TOOLTIP_OFFSET_PX = 8;

export function getViewportTooltipPosition(
    element: HTMLElement,
): ViewportTooltipPosition {
    const rect = element.getBoundingClientRect();

    return {
        left: rect.left + rect.width / 2,
        top: rect.top - TOOLTIP_OFFSET_PX,
    };
}

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
