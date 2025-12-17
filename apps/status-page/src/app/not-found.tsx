import Link from "next/link";

export default function NotFound() {
	return (
		<div className="fade-in zoom-in flex min-h-screen animate-in flex-col items-center justify-center bg-background text-foreground duration-300">
			<div className="container flex max-w-md flex-col items-center justify-center px-4 text-center">
				<h1 className="font-extrabold text-6xl text-primary tracking-tighter">
					404
				</h1>
				<h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-3xl">
					Page not found
				</h2>
				<p className="mt-4 text-base text-muted-foreground leading-relaxed">
					The page you are looking for doesn&apos;t exist or has been moved.
					Please check the URL or try navigating back to the home page.
				</p>
				<div className="mt-8 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
					<Link
						href="/"
						className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-8 font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
					>
						Back to Home
					</Link>
				</div>
			</div>
		</div>
	);
}
