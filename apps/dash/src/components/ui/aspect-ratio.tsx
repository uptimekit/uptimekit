"use client";

import type * as React from "react";

type AspectRatioProps = React.ComponentProps<"div"> & {
	ratio?: number;
};

function AspectRatio({
	ratio = 1,
	style,
	...props
}: AspectRatioProps): React.ReactElement {
	return (
		<div
			data-slot="aspect-ratio"
			style={{ aspectRatio: ratio, ...style }}
			{...props}
		/>
	);
}

export { AspectRatio };
