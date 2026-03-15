import { TopNav } from '../features/layout/TopNav'
import { SideNav } from '../features/layout/SideNav'

interface PageLayoutProps {
  title?: string
  children: React.ReactNode
}

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <main className="forge-grid relative min-h-screen bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 lg:pl-64 xl:px-10">
      <SideNav />

      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-6">
        <div className="lg:hidden">
          <TopNav />
        </div>

        {title && <h1 className="reveal text-2xl font-bold text-white">{title}</h1>}

        <div className="reveal reveal-delay-1">{children}</div>
      </div>
    </main>
  )
}
