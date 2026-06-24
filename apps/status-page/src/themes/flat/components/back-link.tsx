import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

interface BackLinkProps {
	href: string;
	label?: string;
}

export function BackLink({ href, label = "Back to status" }: BackLinkProps) {
	return (
		<div className="mb-8">
			<Link
				href={href as any}
				className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
			>
				<FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
				{label}
			</Link>
		</div>
	);
}
