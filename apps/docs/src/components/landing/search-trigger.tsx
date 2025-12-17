"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export function SearchTrigger() {
  const { setOpenSearch } = useSearchContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
        <button className="hidden sm:flex h-9 w-full min-w-[200px] items-center gap-2 rounded-md border border-fd-border bg-fd-muted/50 px-3 text-sm text-fd-muted-foreground cursor-not-allowed opacity-50">
            <Search className="h-4 w-4" />
            <span>Search...</span>
        </button>
    )
  }

  return (
    <button 
      onClick={() => setOpenSearch(true)}
      className="hidden sm:flex h-9 w-full min-w-[200px] items-center gap-2 rounded-md border border-fd-border bg-fd-muted/50 px-3 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
    >
      <Search className="h-4 w-4" />
      <span>Search...</span>
    </button>
  );
}
