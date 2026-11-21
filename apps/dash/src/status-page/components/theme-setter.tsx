"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import type { StatusPageColorMode } from "@/status-page/themes/types";

export function ThemeSetter({ theme }: { theme?: StatusPageColorMode }) {
    const { setTheme } = useTheme();

    useEffect(() => {
        if (theme) {
            setTheme(theme);
        }
    }, [theme, setTheme]);

    return null;
}
