"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Book, Code, Webhook, ChevronsUpDown, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { useState } from "react";

const options = [
  {
    title: "Uptimekit",
    description: "General Documentation",
    url: "/docs",
    icon: Globe,
    match: (path: string) => path === "/docs" || (path.startsWith("/docs") && !path.startsWith("/docs/sdk") && !path.startsWith("/docs/api")),
  },
  {
    title: "SDK",
    description: "JS/TS SDK",
    url: "/docs/sdk",
    icon: Code,
    match: (path: string) => path.startsWith("/docs/sdk"),
  },
  {
    title: "API",
    description: "REST API",
    url: "/docs/api",
    icon: Webhook,
    match: (path: string) => path.startsWith("/docs/api"),
  },
];

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function DocsSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  
  // Sort by specificity (e.g. check longest paths first or rely on order)
  // Since we rely on simple prefixes, we should be careful.
  const current = options.find((opt) => opt.match(pathname)) || options[0];
  const Icon = current.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground"
        >
          <Icon className="size-4 shrink-0" />
          <div className="flex flex-1 flex-col overflow-hidden">
             <span className="truncate font-medium leading-none">{current.title}</span>
             <span className="truncate text-xs text-fd-muted-foreground mt-1">{current.description}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-fd-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1">
        <div className="flex flex-col gap-1">
          {options.map((opt) => (
            <Link
              key={opt.url}
              href={opt.url}
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
                opt === current && "bg-fd-accent text-fd-accent-foreground"
              )}
            >
              <opt.icon className="size-4 shrink-0" />
              <div className="flex flex-col">
                  <span className="font-medium">{opt.title}</span>
                  <span className="text-xs text-fd-muted-foreground">{opt.description}</span>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
