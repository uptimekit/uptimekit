const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchIntegrationWebhook(
    url: string,
    init: RequestInit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(
                `Webhook request failed with ${response.status}${body ? `: ${body}` : ""}`,
            );
        }

        return response;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Webhook request timed out after ${timeoutMs}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
