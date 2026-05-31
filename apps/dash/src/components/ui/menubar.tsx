"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import type * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type MenubarContentProps = MenuPrimitive.Popup.Props & {
	align?: MenuPrimitive.Positioner.Props["align"];
	alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
	anchor?: MenuPrimitive.Positioner.Props["anchor"];
	side?: MenuPrimitive.Positioner.Props["side"];
	sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
};

function Menubar({
	className,
	...props
}: MenubarPrimitive.Props): React.ReactElement {
	return (
		<MenubarPrimitive
			className={cn(
				"flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
				className,
			)}
			data-slot="menubar"
			{...props}
		/>
	);
}

function MenubarMenu({
	...props
}: MenuPrimitive.Root.Props): React.ReactElement {
	return <MenuPrimitive.Root {...props} />;
}

function MenubarGroup({
	...props
}: MenuPrimitive.Group.Props): React.ReactElement {
	return <MenuPrimitive.Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({
	...props
}: MenuPrimitive.Portal.Props): React.ReactElement {
	return <MenuPrimitive.Portal {...props} />;
}

function MenubarRadioGroup({
	...props
}: MenuPrimitive.RadioGroup.Props): React.ReactElement {
	return (
		<MenuPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
	);
}

function MenubarTrigger({
	className,
	...props
}: MenuPrimitive.Trigger.Props): React.ReactElement {
	return (
		<MenuPrimitive.Trigger
			className={cn(
				"flex select-none items-center rounded-sm px-2 py-1 font-medium text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground",
				className,
			)}
			data-slot="menubar-trigger"
			{...props}
		/>
	);
}

function MenubarContent({
	align = "start",
	alignOffset = -4,
	anchor,
	children,
	className,
	side = "bottom",
	sideOffset = 8,
	...props
}: MenubarContentProps): React.ReactElement {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="z-50"
				data-slot="menubar-positioner"
				side={side}
				sideOffset={sideOffset}
			>
				<MenuPrimitive.Popup
					className={cn(
						"relative flex min-w-48 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
						className,
					)}
					data-slot="menubar-content"
					{...props}
				>
					<div className="max-h-(--available-height) w-full overflow-y-auto p-1">
						{children}
					</div>
				</MenuPrimitive.Popup>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function MenubarItem({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}): React.ReactElement {
	return (
		<MenuPrimitive.Item
			className={cn(
				"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
				className,
			)}
			data-inset={inset}
			data-slot="menubar-item"
			data-variant={variant}
			{...props}
		/>
	);
}

function MenubarCheckboxItem({
	className,
	children,
	checked,
	...props
}: MenuPrimitive.CheckboxItem.Props): React.ReactElement {
	return (
		<MenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(
				"grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			data-slot="menubar-checkbox-item"
			{...props}
		>
			<MenuPrimitive.CheckboxItemIndicator className="col-start-1 -ms-0.5">
				<CheckIcon />
			</MenuPrimitive.CheckboxItemIndicator>
			<span className="col-start-2">{children}</span>
		</MenuPrimitive.CheckboxItem>
	);
}

function MenubarRadioItem({
	className,
	children,
	...props
}: MenuPrimitive.RadioItem.Props): React.ReactElement {
	return (
		<MenuPrimitive.RadioItem
			className={cn(
				"grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			data-slot="menubar-radio-item"
			{...props}
		>
			<MenuPrimitive.RadioItemIndicator className="col-start-1 -ms-0.5">
				<CircleIcon className="size-2 fill-current" />
			</MenuPrimitive.RadioItemIndicator>
			<span className="col-start-2">{children}</span>
		</MenuPrimitive.RadioItem>
	);
}

function MenubarLabel({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}): React.ReactElement {
	return (
		<MenuPrimitive.GroupLabel
			className={cn(
				"px-2 py-1.5 font-medium text-muted-foreground text-xs data-inset:ps-9 sm:data-inset:ps-8",
				className,
			)}
			data-inset={inset}
			data-slot="menubar-label"
			{...props}
		/>
	);
}

function MenubarSeparator({
	className,
	...props
}: MenuPrimitive.Separator.Props): React.ReactElement {
	return (
		<MenuPrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border", className)}
			data-slot="menubar-separator"
			{...props}
		/>
	);
}

function MenubarShortcut({
	className,
	...props
}: React.ComponentProps<"kbd">): React.ReactElement {
	return (
		<kbd
			className={cn(
				"ms-auto font-medium font-sans text-muted-foreground/72 text-xs tracking-widest",
				className,
			)}
			data-slot="menubar-shortcut"
			{...props}
		/>
	);
}

function MenubarSub({
	...props
}: MenuPrimitive.SubmenuRoot.Props): React.ReactElement {
	return <MenuPrimitive.SubmenuRoot data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}): React.ReactElement {
	return (
		<MenuPrimitive.SubmenuTrigger
			className={cn(
				"flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-popup-open:bg-accent data-inset:ps-8 data-highlighted:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not(:last-child)]:-mx-0.5 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
				className,
			)}
			data-inset={inset}
			data-slot="menubar-sub-trigger"
			{...props}
		>
			{children}
			<ChevronRightIcon className="ms-auto -me-0.5 opacity-80" />
		</MenuPrimitive.SubmenuTrigger>
	);
}

function MenubarSubContent({
	align = "start",
	alignOffset,
	className,
	sideOffset = 0,
	...props
}: MenubarContentProps): React.ReactElement {
	const defaultAlignOffset = align !== "center" ? -5 : undefined;

	return (
		<MenubarContent
			align={align}
			alignOffset={alignOffset ?? defaultAlignOffset}
			className={className}
			data-slot="menubar-sub-content"
			side="inline-end"
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

export {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarLabel,
	MenubarMenu,
	MenubarPortal,
	MenubarPrimitive,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSeparator,
	MenubarShortcut,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
};
