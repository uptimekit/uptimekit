"use client";

import { faDesktop, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="flex items-center gap-1 rounded-lg bg-muted p-1">
				<div className="h-7 w-7" />
				<div className="h-7 w-7" />
				<div className="h-7 w-7" />
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 rounded-lg bg-muted p-1">
			<button
				type="button"
				onClick={() => setTheme("light")}
				className={cn(
					"flex h-7 w-7 items-center justify-center rounded-md transition-all",
					theme === "light"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				aria-label="Light mode"
			>
				<FontAwesomeIcon icon={faSun} className="h-4 w-4" />
			</button>
			<button
				type="button"
				onClick={() => setTheme("dark")}
				className={cn(
					"flex h-7 w-7 items-center justify-center rounded-md transition-all",
					theme === "dark"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				aria-label="Dark mode"
			>
				<FontAwesomeIcon icon={faMoon} className="h-4 w-4" />
			</button>
			<button
				type="button"
				onClick={() => setTheme("system")}
				className={cn(
					"flex h-7 w-7 items-center justify-center rounded-md transition-all",
					theme === "system"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				aria-label="System theme"
			>
				<FontAwesomeIcon icon={faDesktop} className="h-4 w-4" />
			</button>
		</div>
	);
}
