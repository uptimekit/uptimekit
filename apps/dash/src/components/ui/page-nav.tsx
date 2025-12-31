"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

function PageNavRoot({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            data-slot="page-nav"
            className={cn("w-full gap-6", className)}
            {...props}
        />
    );
}

function PageNavList({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="page-nav-list"
            className={cn(
                "flex h-auto w-full flex-wrap items-center justify-start gap-6 rounded-none border-border/40 border-b bg-transparent p-0 px-1 pt-2",
                className,
            )}
            {...props}
        />
    );
}

function PageNavTrigger({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="page-nav-trigger"
            className={cn(
                "relative h-auto flex-none rounded-none border-0 bg-transparent px-1 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary",
                className,
            )}
            {...props}
        />
    );
}

function PageNavContent({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="page-nav-content"
            className={cn("mt-6 flex-1 outline-none", className)}
            {...props}
        />
    );
}

const PageNav = Object.assign(PageNavRoot, {
    List: PageNavList,
    Trigger: PageNavTrigger,
    Content: PageNavContent,
});

export { PageNav, PageNavRoot, PageNavList, PageNavTrigger, PageNavContent };
