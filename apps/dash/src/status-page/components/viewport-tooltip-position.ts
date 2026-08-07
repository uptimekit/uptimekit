export interface ViewportTooltipPosition {
    left: number;
    top: number;
}

const TOOLTIP_OFFSET_PX = 8;

export function getViewportTooltipPosition(
    element: HTMLElement,
): ViewportTooltipPosition {
    const rect = element.getBoundingClientRect();
    return {
        left: rect.left + rect.width / 2,
        top: rect.top - TOOLTIP_OFFSET_PX,
    };
}
