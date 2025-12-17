import Link from "next/link";
import { Github } from "lucide-react";
import { SearchTrigger } from "./search-trigger";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-fd-border/50 bg-fd-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
        <div className="mr-8 flex items-center gap-2">
          {/* Logo */}
          <img src="https://r2.uptimekit.dev/logos/uptimekit.svg" alt="UptimeKit" className="h-6 w-auto" />
          <Link href="/" className="font-bold text-lg tracking-tight text-fd-foreground">
            UptimeKit
          </Link>
        </div>

        <nav className="flex items-center gap-6 text-sm font-medium text-fd-muted-foreground">
          <Link href="/docs" className="transition-colors hover:text-fd-foreground">
            Documentation
          </Link>
          {/* <Link href="/blog" className="transition-colors hover:text-fd-foreground">
            Blog
          </Link>
          <Link href="/showcase" className="hidden transition-colors hover:text-fd-foreground sm:block">
            Showcase
          </Link> */}
        </nav>

        <div className="ml-auto flex items-center gap-2">
			{/* Search Placeholder */}
          <SearchTrigger />
          
          <Link
            href="https://github.com/stripsior/uptimekit"
            target="_blank"
            className="rounded-md p-2 text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
          >
            <Github className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
