import Link from 'next/link'
import { Button } from '@/components/ui/button'


export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground animate-in fade-in zoom-in duration-300">
      <div className="container flex max-w-md flex-col items-center justify-center text-center px-4">

        <h1 className="text-6xl font-extrabold tracking-tighter text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h2>
        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
          The page you are looking for doesn&apos;t exist or has been moved.
          Please check the URL or try navigating back to the home page.
        </p>
        <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="rounded-full px-8 font-semibold">
            <Link href="/">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
