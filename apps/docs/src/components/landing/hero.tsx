import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
	return (
		<section className="relative overflow-hidden pt-16 pb-16 md:pt-24 lg:pt-32">
			{/* Background Gradients */}
			<div className="-top-40 -z-10 sm:-top-80 absolute inset-x-0 transform-gpu overflow-hidden blur-3xl">
				<div
					className="-translate-x-1/2 relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] rotate-[30deg] bg-gradient-to-tr from-fd-border to-fd-background opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
					style={{
						clipPath:
							"polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
					}}
				/>
			</div>

			<div className="container relative z-10 mx-auto px-4 text-center md:px-6">
				<div className="mb-8 inline-flex items-center rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1 font-medium text-fd-secondary-foreground text-sm backdrop-blur-md">
					<span className="mr-2 flex h-2 w-2 rounded-full bg-fd-primary" />
					The status page system you love
				</div>

				<h1 className="mx-auto mb-6 max-w-4xl text-balance font-extrabold text-5xl text-fd-foreground tracking-tight sm:text-6xl md:text-7xl">
					Build excellent status pages,{" "}
					<span className="text-fd-muted-foreground">your style.</span>
				</h1>

				<p className="mx-auto mb-10 max-w-2xl text-balance text-fd-muted-foreground text-lg">
					Open source status page system designed for modern engineering teams.
					Monitor your services, notify your users, and stay transparent.
				</p>

				<div className="mb-20 flex flex-col items-center justify-center gap-4 sm:flex-row">
					<Link
						href="/docs"
						className="inline-flex h-12 items-center justify-center rounded-md bg-fd-primary px-8 font-medium text-fd-primary-foreground text-sm shadow transition-colors hover:bg-fd-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring"
					>
						Getting Started
					</Link>
					<Link
						href="https://github.com/uptimekit/uptimekit"
						target="_blank"
						className="inline-flex h-12 items-center justify-center rounded-md border border-fd-border bg-fd-background px-8 font-medium text-sm shadow-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring"
					>
						Github
						<ArrowRight className="ml-2 h-4 w-4" />
					</Link>
				</div>

				{/* Panel Placeholder / Launchpad */}
				<div className="relative mx-auto max-w-5xl">
					<img
						src="https://r2.uptimekit.dev/banners/cover.png"
						alt="UptimeKit Dashboard Preview"
						className="w-full rounded-2xl border border-fd-border shadow-2xl"
					/>
				</div>
			</div>
		</section>
	);
}
