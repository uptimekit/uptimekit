import type { ComponentType } from "react";
import { ThemeProvider } from "./theme-provider";

interface ThemePageWrapperProps<T extends Record<string, any>> {
	themeId: string;
	theme?: "light" | "dark";
	ThemeComponent: ComponentType<T>;
	componentProps: T;
}

type PropsWithCustomCss = {
	data?: {
		config?: {
			design?: {
				customCss?: unknown;
			};
		};
	};
};

function getCustomCss(componentProps: Record<string, any>): string {
	const customCss = (componentProps as PropsWithCustomCss).data?.config?.design
		?.customCss;

	return typeof customCss === "string" ? customCss : "";
}

export function ThemePageWrapper<T extends Record<string, any>>({
	themeId,
	theme,
	ThemeComponent,
	componentProps,
}: ThemePageWrapperProps<T>) {
	const sanitizedThemeId = JSON.stringify(themeId);
	const customCss = getCustomCss(componentProps);

	const themeScript = `
		(function() {
			document.documentElement.setAttribute('data-theme', ${sanitizedThemeId});
			${theme ? `document.documentElement.classList.${theme === "dark" ? "add" : "remove"}('dark');` : ""}
		})();
	`;

	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: its okay
				dangerouslySetInnerHTML={{ __html: themeScript }}
				suppressHydrationWarning
			/>
			<ThemeProvider themeId={themeId} theme={theme} />
			{customCss.trim() && <style data-uptimekit-custom-css>{customCss}</style>}
			<ThemeComponent {...componentProps} />
		</>
	);
}
