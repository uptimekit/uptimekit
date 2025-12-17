"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeSetter({ theme }: { theme?: "light" | "dark" }) {
	const { setTheme } = useTheme();

	useEffect(() => {
		if (theme) {
			setTheme(theme);
		}
	}, [theme, setTheme]);

	return null;
}
