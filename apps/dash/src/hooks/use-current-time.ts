"use client";

import { useSyncExternalStore } from "react";

let currentTime = Date.now();

function subscribe(onStoreChange: () => void) {
    currentTime = Date.now();
    const interval = setInterval(() => {
        currentTime = Date.now();
        onStoreChange();
    }, 60_000);
    return () => clearInterval(interval);
}

export function useCurrentTime() {
    return useSyncExternalStore(
        subscribe,
        () => currentTime,
        () => 0,
    );
}
