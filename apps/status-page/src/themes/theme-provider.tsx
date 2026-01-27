"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

interface ThemeProviderProps {
	themeId: string;
	cssFile?: string;
	theme?: "light" | "dark";
}

export function ThemeProvider({ themeId, cssFile, theme }: ThemeProviderProps) {
	const { setTheme } = useTheme();

	useEffect(() => {
		// Set data-theme attribute
		document.documentElement.setAttribute("data-theme", themeId);

		// Set light/dark theme if specified
		if (theme) {
			setTheme(theme);
		}

		// Load custom CSS if specified
		const linkId = `theme-css-${themeId}`;
		if (cssFile) {
			const existingLink = document.getElementById(linkId) as HTMLLinkElement;
			if (existingLink) {
				if (existingLink.getAttribute("href") === cssFile) {
					return;
				}
				existingLink.remove();
			}

			const link = document.createElement("link");
			link.id = linkId;
			link.rel = "stylesheet";
			link.href = cssFile;
			document.head.appendChild(link);
		}

		return () => {
			document.documentElement.removeAttribute("data-theme");
			const linkToRemove = document.getElementById(linkId);
			if (linkToRemove) {
				linkToRemove.remove();
			}
		};
	}, [themeId, cssFile, theme, setTheme]);

	return null;
}
