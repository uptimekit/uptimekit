"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Wraps Radix Tabs.Root to provide the page navigation root with default layout and spacing.
 *
 * @param className - Additional CSS class names to append to the root element
 * @param props - All other props are forwarded to TabsPrimitive.Root
 * @returns The rendered TabsPrimitive.Root element configured for page navigation
 */
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

/**
 * Styled wrapper around Radix Tabs List that provides layout and visual defaults for page navigation.
 *
 * @param className - Additional CSS class names to append to the component's default classes.
 * @returns A React element rendering a TabsPrimitive.List configured for page navigation.
 */
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

/**
 * Renders a page-navigation tab trigger with navigation-specific styling and attributes.
 *
 * Merges any provided `className` with the component's default styles, forwards all other props to the underlying TabsPrimitive.Trigger, and exposes a `data-slot="page-nav-trigger"` attribute for slot-targeting.
 *
 * @param className - Additional CSS class names to merge with the component's default classes
 * @returns A configured TabsPrimitive.Trigger element for use in the PageNav component
 */
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

/**
 * Renders the page navigation content area using Radix Tabs.Content.
 *
 * Accepts all props of `TabsPrimitive.Content` and applies a `data-slot="page-nav-content"` attribute
 * and default layout classes; any provided `className` is merged with the defaults.
 *
 * @returns The `TabsPrimitive.Content` React element configured for the page navigation area.
 */
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