import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import InviteClient from "./invite-client";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

export default async function InvitePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;

	const [invitationData] = await db
		.select({
			id: schema.invitation.id,
			email: schema.invitation.email,
			organizationName: schema.organization.name,
			organizationId: schema.invitation.organizationId,
			status: schema.invitation.status,
			expiresAt: schema.invitation.expiresAt,
		})
		.from(schema.invitation)
		.leftJoin(
			schema.organization,
			eq(schema.invitation.organizationId, schema.organization.id),
		)
		.where(eq(schema.invitation.id, token))
		.limit(1);

	if (
		!invitationData ||
		invitationData.status !== "pending" ||
		new Date() > invitationData.expiresAt
	) {
		notFound();
	}

	return (
		<InviteClient
			token={token}
			invitation={{
				id: invitationData.id,
				email: invitationData.email,
				organizationName: invitationData.organizationName || "Organization",
			}}
		/>
	);
}
