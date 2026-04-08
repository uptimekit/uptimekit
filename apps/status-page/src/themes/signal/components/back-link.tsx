import Link from "next/link";

export function BackLink({ href }: { href: string }) {
	return (
		<Link
			href={href as any}
			className="inline-flex w-fit items-center gap-2 rounded-lg px-1 py-1 font-medium text-[13px] text-muted-foreground transition-colors hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>Back to status</span>
		</Link>
	);
}
