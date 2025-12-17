import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<div className="flex items-center gap-2">
					<Image
						src="https://r2.uptimekit.dev/logos/uptimekit-dark.svg"
						alt="Uptimekit Logo"
						width={24}
						height={24}
						className="size-6 dark:hidden"
					/>
					<Image
						src="https://r2.uptimekit.dev/logos/uptimekit.svg"
						alt="Uptimekit Logo"
						width={24}
						height={24}
						className="hidden size-6 dark:block"
					/>
					<span className="font-semibold">Uptimekit</span>
				</div>
			),
		},
	};
}
