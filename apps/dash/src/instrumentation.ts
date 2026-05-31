export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}

	const { ensureNotificationWorkerStarted } = await import(
		"@uptimekit/api/pkg/notifications"
	);

	await ensureNotificationWorkerStarted();
}
