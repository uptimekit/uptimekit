type SubscriberEmailTemplateInput = {
	eventLabel: string;
	statusPageName: string;
	incidentTitle: string;
	severity: string;
	description: string;
	incidentUrl: string;
};

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function renderSubscriberEmailText(
	input: SubscriberEmailTemplateInput,
) {
	return [
		input.eventLabel,
		"",
		`Status page: ${input.statusPageName}`,
		`Incident: ${input.incidentTitle}`,
		`Severity: ${input.severity}`,
		"",
		input.description,
		"",
		`View incident: ${input.incidentUrl}`,
	].join("\n");
}

export function renderSubscriberEmailHtml(
	input: SubscriberEmailTemplateInput,
) {
	const eventLabel = escapeHtml(input.eventLabel);
	const statusPageName = escapeHtml(input.statusPageName);
	const incidentTitle = escapeHtml(input.incidentTitle);
	const severity = escapeHtml(input.severity);
	const description = escapeHtml(input.description);
	const incidentUrl = escapeHtml(input.incidentUrl);
	console.log("sending email", input)

	return `
		<!doctype html>
		<html>
			<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
				<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
					<div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
						<div style="font-size:18px;font-weight:700;color:#111827;">${eventLabel}</div>
						<div style="margin-top:6px;font-size:14px;color:#6b7280;">Status page: ${statusPageName}</div>
					</div>
					<div style="padding:24px;">
						<div style="font-size:20px;font-weight:700;color:#111827;">${incidentTitle}</div>
						<div style="margin-top:12px;font-size:14px;color:#374151;">
							<strong>Severity:</strong> ${severity}
						</div>
						<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#374151;">${description}</p>
						<div style="margin-top:24px;">
							<a href="${incidentUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
								View incident
							</a>
						</div>
					</div>
				</div>
			</body>
		</html>
	`.trim();
}
