import { useSyncExternalStore } from "react";

function subscribe() {
    return () => undefined;
}

function getBrowserOrigin() {
    return window.location.origin;
}

function getServerOrigin() {
    return "";
}

export function useBrowserOrigin() {
    return useSyncExternalStore(subscribe, getBrowserOrigin, getServerOrigin);
}
