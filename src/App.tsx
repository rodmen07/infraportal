import { SessionPanel } from './features/auth/SessionPanel'
import { useAuthSession } from './features/auth/useAuthSession'
import { TopNav } from './features/layout/TopNav'
import { HomeSections } from './features/site/HomeSections'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { IntegrationsSection } from './features/site/IntegrationsSection'
import { SiteHeader } from './features/site/SiteHeader'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useSiteContent } from './features/site/useSiteContent'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)
  const homeSections = useHomeSectionsContent(baseUrl)

  const {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    passwordInput,
    setPasswordInput,
    signIn,
    createUsername,
    signInWithOAuth,
    signOut,
  } = useAuthSession()

  return (
    <main className="forge-grid relative min-h-screen bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 xl:px-10 2xl:px-14">
      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
        <TopNav />

        <SiteHeader content={content} />

        <SessionPanel
          isAuthenticated={isAuthenticated}
          authLoading={authLoading}
          authBusy={authBusy}
          authError={authError}
          subjectInput={subjectInput}
          passwordInput={passwordInput}
          currentSubject={session?.subject || ''}
          currentRoles={session?.roles || []}
          onSubjectInputChange={setSubjectInput}
          onPasswordInputChange={setPasswordInput}
          onSignIn={signIn}
          onCreateUsername={createUsername}
          onSignInWithGitHub={() => signInWithOAuth('github')}
          onSignInWithGoogle={() => signInWithOAuth('google')}
          onSignOut={signOut}
        />

        <HowItWorksSection />

        <HomeSections content={homeSections} />

        <IntegrationsSection />
      </div>
    </main>
  )
}

export default App
