import type { ComponentType } from "react";
import { getThemeManifest } from "@/lib/theme-loader";
import { ThemeProvider } from "./theme-provider";

interface ThemePageWrapperProps<T extends Record<string, any>> {
	themeId: string;
	theme?: "light" | "dark";
	ThemeComponent: ComponentType<T>;
	componentProps: T;
}

export function ThemePageWrapper<T extends Record<string, any>>({
	themeId,
	theme,
	ThemeComponent,
	componentProps,
}: ThemePageWrapperProps<T>) {
	const manifest = getThemeManifest(themeId);

	const sanitizedThemeId = JSON.stringify(themeId);

	const themeScript = `
		(function() {
			const root = document.documentElement;
			root.setAttribute('data-theme', ${sanitizedThemeId});
			${theme ? `root.classList.${theme === "dark" ? "add" : "remove"}('dark');` : ""}
		})();
	`;

	return (
		<>
			<script
				dangerouslySetInnerHTML={{ __html: themeScript }}
				suppressHydrationWarning
			/>
			<ThemeProvider
				themeId={themeId}
				cssFile={manifest?.cssFile}
				theme={theme}
			/>
			<ThemeComponent {...componentProps} />
		</>
	);
}
