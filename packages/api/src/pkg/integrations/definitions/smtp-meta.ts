import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

const EmailAddressSchema = z.string().trim().email();

function isValidEmailList(value: string) {
	const recipients = value
		.split(/[;,]/)
		.map((recipient) => recipient.trim())
		.filter(Boolean);

	return (
		recipients.length > 0 &&
		recipients.every(
			(recipient) => EmailAddressSchema.safeParse(recipient).success,
		)
	);
}

export const SmtpConfigSchema = z.object({
	host: z.string().trim().min(1, { message: "SMTP host is required" }),
	port: z.coerce
		.number()
		.int({ message: "SMTP port must be a whole number" })
		.min(1, { message: "SMTP port must be greater than 0" })
		.max(65_535, { message: "SMTP port must be 65535 or lower" })
		.default(587),
	secure: z.enum(["auto", "true", "false"]).default("auto"),
	username: z.string().trim().optional(),
	password: z.string().optional(),
	from: z.string().trim().email({ message: "From address must be valid" }),
	to: z
		.string()
		.trim()
		.min(1, { message: "At least one recipient is required" })
		.refine(isValidEmailList, {
			message: "Enter valid recipient email addresses separated by commas",
		}),
});

export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

export const smtpIntegrationMeta: Omit<
	IntegrationDefinition<SmtpConfig>,
	"handler"
> = {
	id: "smtp",
	name: "SMTP Email",
	type: "export",
	description: "Send incident and SSL notifications through an SMTP server.",
	configSchema: SmtpConfigSchema,
	events: [
		"incident.created",
		"incident.resolved",
		"incident.acknowledged",
		"incident.comment_added",
		"monitor.ssl.expiring",
		"integration.test",
	],
};
