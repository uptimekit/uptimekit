import { faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

type PanelGroupProps = React.ComponentProps<"div"> & {
	direction?: "horizontal" | "vertical";
	orientation?: "horizontal" | "vertical";
};

type HandleProps = React.ComponentProps<"div"> & {
	disabled?: boolean;
};

const resizablePrimitive = ResizablePrimitive as typeof ResizablePrimitive & {
	PanelGroup?: React.ComponentType<PanelGroupProps>;
	Group?: React.ComponentType<PanelGroupProps>;
	PanelResizeHandle?: React.ComponentType<HandleProps>;
	Separator?: React.ComponentType<HandleProps>;
};

const PanelGroupPrimitive = (resizablePrimitive.PanelGroup ??
	resizablePrimitive.Group) as React.ComponentType<PanelGroupProps>;
const ResizeHandlePrimitive = (resizablePrimitive.PanelResizeHandle ??
	resizablePrimitive.Separator) as React.ComponentType<HandleProps>;

function ResizablePanelGroup({
	className,
	direction,
	orientation,
	...props
}: PanelGroupProps) {
	const panelDirection = orientation ?? direction ?? "horizontal";
	const primitiveProps =
		resizablePrimitive.PanelGroup === PanelGroupPrimitive
			? { ...props, direction: panelDirection }
			: { ...props, orientation: panelDirection };

	return (
		<PanelGroupPrimitive
			data-slot="resizable-panel-group"
			data-panel-group-direction={panelDirection}
			className={cn(
				"flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
				className,
			)}
			{...primitiveProps}
		/>
	);
}

function ResizablePanel({
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: HandleProps & {
	withHandle?: boolean;
}) {
	return (
		<ResizeHandlePrimitive
			data-slot="resizable-handle"
			className={cn(
				"relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
				className,
			)}
			{...props}
		>
			{withHandle && (
				<div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
					<FontAwesomeIcon icon={faGripVertical} className="size-2.5" />
				</div>
			)}
		</ResizeHandlePrimitive>
	);
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
