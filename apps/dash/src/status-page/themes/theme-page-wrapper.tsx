import type { ComponentType } from "react";
import { ThemeProvider } from "./theme-provider";
import type { StatusPageColorMode } from "./types";

interface ThemePageWrapperProps<T extends Record<string, any>> {
    themeId: string;
    theme?: StatusPageColorMode;
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
    const customCss = (componentProps as PropsWithCustomCss).data?.config
        ?.design?.customCss;

    return typeof customCss === "string" ? customCss : "";
}

export function ThemePageWrapper<T extends Record<string, any>>({
    themeId,
    theme,
    ThemeComponent,
    componentProps,
}: ThemePageWrapperProps<T>) {
    const sanitizedThemeId = JSON.stringify(themeId);
    const isDarkExpression =
        theme === "system"
            ? "window.matchMedia('(prefers-color-scheme: dark)').matches"
            : String(theme === "dark");
    const customCss = getCustomCss(componentProps);

    const themeScript = `
		(function() {
			document.documentElement.setAttribute('data-theme', ${sanitizedThemeId});
			${theme ? `document.documentElement.classList.toggle('dark', ${isDarkExpression});` : ""}
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
            {customCss.trim() && (
                <style data-uptimekit-custom-css>{customCss}</style>
            )}
            <ThemeComponent {...componentProps} />
        </>
    );
}
