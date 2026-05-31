"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import type * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ContextMenuContentProps = ContextMenuPrimitive.Popup.Props & {
	align?: ContextMenuPrimitive.Positioner.Props["align"];
	alignOffset?: ContextMenuPrimitive.Positioner.Props["alignOffset"];
	anchor?: ContextMenuPrimitive.Positioner.Props["anchor"];
	side?: ContextMenuPrimitive.Positioner.Props["side"];
	sideOffset?: ContextMenuPrimitive.Positioner.Props["sideOffset"];
};

function ContextMenu(
	props: ContextMenuPrimitive.Root.Props,
): React.ReactElement {
	return <ContextMenuPrimitive.Root {...props} />;
}

function ContextMenuTrigger({
	...props
}: ContextMenuPrimitive.Trigger.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
	);
}

function ContextMenuGroup({
	...props
}: ContextMenuPrimitive.Group.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
	);
}

function ContextMenuPortal({
	...props
}: ContextMenuPrimitive.Portal.Props): React.ReactElement {
	return <ContextMenuPrimitive.Portal {...props} />;
}

function ContextMenuSub({
	...props
}: ContextMenuPrimitive.SubmenuRoot.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
	);
}

function ContextMenuRadioGroup({
	...props
}: ContextMenuPrimitive.RadioGroup.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.RadioGroup
			data-slot="context-menu-radio-group"
			{...props}
		/>
	);
}

function ContextMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}): React.ReactElement {
	return (
		<ContextMenuPrimitive.SubmenuTrigger
			className={cn(
				"flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-popup-open:bg-accent data-inset:ps-8 data-highlighted:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not(:last-child)]:-mx-0.5 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
				className,
			)}
			data-inset={inset}
			data-slot="context-menu-sub-trigger"
			{...props}
		>
			{children}
			<ChevronRightIcon className="ms-auto -me-0.5 opacity-80" />
		</ContextMenuPrimitive.SubmenuTrigger>
	);
}

function ContextMenuPopup({
	align = "start",
	alignOffset,
	anchor,
	children,
	className,
	side = "bottom",
	sideOffset = 4,
	...props
}: ContextMenuContentProps): React.ReactElement {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="z-50"
				data-slot="context-menu-positioner"
				side={side}
				sideOffset={sideOffset}
			>
				<ContextMenuPrimitive.Popup
					className={cn(
						"relative flex not-[class*='w-']:min-w-32 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
						className,
					)}
					data-slot="context-menu-content"
					{...props}
				>
					<div className="max-h-(--available-height) w-full overflow-y-auto p-1">
						{children}
					</div>
				</ContextMenuPrimitive.Popup>
			</ContextMenuPrimitive.Positioner>
		</ContextMenuPrimitive.Portal>
	);
}

function ContextMenuSubContent({
	align = "start",
	alignOffset,
	className,
	sideOffset = 0,
	...props
}: ContextMenuContentProps): React.ReactElement {
	const defaultAlignOffset = align !== "center" ? -5 : undefined;

	return (
		<ContextMenuPopup
			align={align}
			alignOffset={alignOffset ?? defaultAlignOffset}
			className={className}
			data-slot="context-menu-sub-content"
			side="inline-end"
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function ContextMenuContent(
	props: ContextMenuContentProps,
): React.ReactElement {
	return <ContextMenuPopup {...props} />;
}

function ContextMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: ContextMenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}): React.ReactElement {
	return (
		<ContextMenuPrimitive.Item
			className={cn(
				"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
				className,
			)}
			data-inset={inset}
			data-slot="context-menu-item"
			data-variant={variant}
			{...props}
		/>
	);
}

function ContextMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: ContextMenuPrimitive.CheckboxItem.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(
				"grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			data-slot="context-menu-checkbox-item"
			{...props}
		>
			<ContextMenuPrimitive.CheckboxItemIndicator className="col-start-1 -ms-0.5">
				<CheckIcon />
			</ContextMenuPrimitive.CheckboxItemIndicator>
			<span className="col-start-2">{children}</span>
		</ContextMenuPrimitive.CheckboxItem>
	);
}

function ContextMenuRadioItem({
	className,
	children,
	...props
}: ContextMenuPrimitive.RadioItem.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.RadioItem
			className={cn(
				"grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			data-slot="context-menu-radio-item"
			{...props}
		>
			<ContextMenuPrimitive.RadioItemIndicator className="col-start-1 -ms-0.5">
				<CircleIcon className="size-2 fill-current" />
			</ContextMenuPrimitive.RadioItemIndicator>
			<span className="col-start-2">{children}</span>
		</ContextMenuPrimitive.RadioItem>
	);
}

function ContextMenuLabel({
	className,
	inset,
	...props
}: ContextMenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}): React.ReactElement {
	return (
		<ContextMenuPrimitive.GroupLabel
			className={cn(
				"px-2 py-1.5 font-medium text-muted-foreground text-xs data-inset:ps-9 sm:data-inset:ps-8",
				className,
			)}
			data-inset={inset}
			data-slot="context-menu-label"
			{...props}
		/>
	);
}

function ContextMenuSeparator({
	className,
	...props
}: ContextMenuPrimitive.Separator.Props): React.ReactElement {
	return (
		<ContextMenuPrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border", className)}
			data-slot="context-menu-separator"
			{...props}
		/>
	);
}

function ContextMenuShortcut({
	className,
	...props
}: React.ComponentProps<"kbd">): React.ReactElement {
	return (
		<kbd
			className={cn(
				"ms-auto font-medium font-sans text-muted-foreground/72 text-xs tracking-widest",
				className,
			)}
			data-slot="context-menu-shortcut"
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuPopup,
	ContextMenuPortal,
	ContextMenuPrimitive,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
};
