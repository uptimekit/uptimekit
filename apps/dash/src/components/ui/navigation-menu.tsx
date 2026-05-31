"use client";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function NavigationMenu({
	className,
	children,
	viewport = true,
	...props
}: NavigationMenuPrimitive.Root.Props & {
	viewport?: boolean;
}): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Root
			className={cn(
				"group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
				className,
			)}
			data-slot="navigation-menu"
			data-viewport={viewport}
			{...props}
		>
			{children}
			{viewport && <NavigationMenuViewport />}
		</NavigationMenuPrimitive.Root>
	);
}

function NavigationMenuList({
	className,
	...props
}: NavigationMenuPrimitive.List.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.List
			className={cn(
				"group flex flex-1 list-none items-center justify-center gap-1",
				className,
			)}
			data-slot="navigation-menu-list"
			{...props}
		/>
	);
}

function NavigationMenuItem({
	className,
	...props
}: NavigationMenuPrimitive.Item.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Item
			className={cn("relative", className)}
			data-slot="navigation-menu-item"
			{...props}
		/>
	);
}

const navigationMenuTriggerStyle = cva(
	"group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 font-medium text-sm outline-none transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-open:bg-accent/50 data-open:text-accent-foreground data-open:focus:bg-accent data-open:hover:bg-accent",
);

function NavigationMenuTrigger({
	className,
	children,
	...props
}: NavigationMenuPrimitive.Trigger.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Trigger
			className={cn(navigationMenuTriggerStyle(), "group", className)}
			data-slot="navigation-menu-trigger"
			{...props}
		>
			{children}{" "}
			<NavigationMenuPrimitive.Icon data-slot="navigation-menu-icon">
				<ChevronDownIcon
					aria-hidden="true"
					className="relative top-[1px] ml-1 size-3 transition duration-300 group-data-open:rotate-180"
				/>
			</NavigationMenuPrimitive.Icon>
		</NavigationMenuPrimitive.Trigger>
	);
}

function NavigationMenuContent({
	className,
	...props
}: NavigationMenuPrimitive.Content.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Content
			className={cn(
				"top-0 left-0 w-full p-2 pr-2.5 transition-[opacity,translate] data-[activation-direction=left]:-translate-x-12 data-[activation-direction=right]:translate-x-12 data-ending-style:opacity-0 data-starting-style:opacity-0 md:absolute md:w-auto",
				"group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-md group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow",
				className,
			)}
			data-slot="navigation-menu-content"
			{...props}
		/>
	);
}

function NavigationMenuViewport({
	className,
	...props
}: NavigationMenuPrimitive.Viewport.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Positioner
				className="absolute top-full left-0 isolate z-50 flex justify-center"
				data-slot="navigation-menu-positioner"
				side="bottom"
				sideOffset={6}
			>
				<NavigationMenuPrimitive.Popup
					className="origin-(--transform-origin) rounded-md border bg-popover text-popover-foreground shadow transition-[scale,opacity] data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0"
					data-slot="navigation-menu-popup"
				>
					<NavigationMenuPrimitive.Viewport
						className={cn(
							"relative h-(--popup-height) w-full overflow-hidden md:w-(--popup-width)",
							className,
						)}
						data-slot="navigation-menu-viewport"
						{...props}
					/>
				</NavigationMenuPrimitive.Popup>
			</NavigationMenuPrimitive.Positioner>
		</NavigationMenuPrimitive.Portal>
	);
}

function NavigationMenuLink({
	className,
	...props
}: NavigationMenuPrimitive.Link.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Link
			className={cn(
				"flex flex-col gap-1 rounded-sm p-2 text-sm outline-none transition-all hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-active:bg-accent/50 data-active:text-accent-foreground data-active:focus:bg-accent data-active:hover:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
				className,
			)}
			data-slot="navigation-menu-link"
			{...props}
		/>
	);
}

function NavigationMenuIndicator({
	className,
	...props
}: NavigationMenuPrimitive.Arrow.Props): React.ReactElement {
	return (
		<NavigationMenuPrimitive.Arrow
			className={cn(
				"top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden",
				className,
			)}
			data-slot="navigation-menu-indicator"
			{...props}
		>
			<div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
		</NavigationMenuPrimitive.Arrow>
	);
}

export {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuIndicator,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuPrimitive,
	NavigationMenuTrigger,
	NavigationMenuViewport,
	navigationMenuTriggerStyle,
};
