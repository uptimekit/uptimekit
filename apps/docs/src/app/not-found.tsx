import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-fd-background text-fd-foreground">
			<div className="container mx-auto flex max-w-md flex-col items-center justify-center px-4 text-center">
				<h1 className="font-extrabold text-6xl text-fd-primary tracking-tighter">
					404
				</h1>
				<h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-3xl">
					Page not found
				</h2>
				<p className="mt-4 text-base text-fd-muted-foreground leading-relaxed">
					The page you are looking for doesn&apos;t exist or has been moved.
					Please check the URL or try navigating back to the home page.
				</p>
				<div className="mt-8 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
					<Link
						href="/"
						className="inline-flex h-10 items-center justify-center rounded-full bg-fd-primary px-8 font-semibold text-fd-primary-foreground shadow transition-colors hover:bg-fd-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-50"
					>
						Back to Home
					</Link>
				</div>
			</div>
		</div>
	);
}
