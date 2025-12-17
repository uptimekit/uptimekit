import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uptimekit - Open Source Status Page & Monitoring",
  description: "Beautiful status pages and powerful monitoring for your services. Open source and self-hostable.",
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-fd-background">
      <Navbar />
      <Hero />
      <div className="container mx-auto px-4 pb-20 text-center text-sm text-fd-muted-foreground">
        <p>© {new Date().getFullYear()} UptimeKit. Open Source.</p>
      </div>
    </main>
  );
}
