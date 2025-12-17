import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<div className="flex items-center gap-2">
					<Image
						src="https://r2.uptimekit.dev/logos/uptimekit.svg"
						alt="Uptimekit Logo"
						width={24}
						height={24}
						className="size-6"
					/>
					<span className="font-semibold">Uptimekit</span>
				</div>
			),
		},
	};
}
