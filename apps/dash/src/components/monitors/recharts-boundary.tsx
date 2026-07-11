"use client";

import { lazy, type ReactNode, Suspense } from "react";

type RechartsModule = typeof import("recharts");

interface RechartsModuleContentProps {
    children: (recharts: RechartsModule) => ReactNode;
}

const RechartsModuleContent = lazy(async () => {
    const recharts = await import("recharts");

    return {
        default: function RechartsModuleContent({
            children,
        }: RechartsModuleContentProps) {
            return children(recharts);
        },
    };
});

export function RechartsBoundary({
    children,
    fallback,
}: RechartsModuleContentProps & { fallback?: ReactNode }) {
    return (
        <Suspense fallback={fallback ?? null}>
            <RechartsModuleContent>{children}</RechartsModuleContent>
        </Suspense>
    );
}
