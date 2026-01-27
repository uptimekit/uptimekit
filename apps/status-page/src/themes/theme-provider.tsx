"use client";

import { useTheme } from "next-themes";
import { useLayoutEffect } from "react";

interface ThemeProviderProps {
	themeId: string;
	theme?: "light" | "dark";
}

export function ThemeProvider({ themeId, theme }: ThemeProviderProps) {
	const { setTheme } = useTheme();

	useLayoutEffect(() => {
		// Set data-theme attribute
		const currentTheme = document.documentElement.getAttribute("data-theme");
		if (currentTheme !== themeId) {
			document.documentElement.setAttribute("data-theme", themeId);
		}

		// Set light/dark theme if specified
		if (theme) {
			setTheme(theme);
		}
	}, [themeId, theme, setTheme]);

	return null;
}
