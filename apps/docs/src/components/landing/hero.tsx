import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 md:pt-24 lg:pt-32 pb-16">
      {/* Background Gradients */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-fd-border to-fd-background opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" 
             style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }}
        />
      </div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <div className="inline-flex items-center rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1 text-sm font-medium text-fd-secondary-foreground backdrop-blur-md mb-8">
          <span className="flex h-2 w-2 rounded-full bg-fd-primary mr-2"></span>
          The status page system you love
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-fd-foreground sm:text-6xl md:text-7xl mb-6 text-balance">
          Build excellent status pages, <span className="text-fd-muted-foreground">your style.</span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground mb-10 text-balance">
          Open source status page system designed for modern engineering teams. 
          Monitor your services, notify your users, and stay transparent.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            href="/docs"
            className="inline-flex h-12 items-center justify-center rounded-md bg-fd-primary px-8 text-sm font-medium text-fd-primary-foreground shadow transition-colors hover:bg-fd-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring"
          >
            Getting Started
          </Link>
          <Link
            href="https://github.com/stripsior/uptimekit"
            target="_blank"
            className="inline-flex h-12 items-center justify-center rounded-md border border-fd-border bg-fd-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring"
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
