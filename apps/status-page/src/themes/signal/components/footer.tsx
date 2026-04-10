export function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-border/60 border-t py-5">
			<div className="mx-auto flex w-full max-w-[822px] items-center justify-between gap-4 px-4 text-[12px] text-muted-foreground">
				<div>&copy; {year}</div>
				<a
					href="https://github.com/uptimekit/uptimekit"
					target="_blank"
					rel="noopener noreferrer"
					className="transition-colors hover:text-foreground"
				>
					Powered by UptimeKit
				</a>
			</div>
		</footer>
	);
}
