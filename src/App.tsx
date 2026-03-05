import { useEffect, useMemo, useState } from 'react'
import { AdminDashboardSection } from './features/admin/AdminDashboardSection'
import { useAdminDashboard } from './features/admin/useAdminDashboard'
import { SessionPanel } from './features/auth/SessionPanel'
import { useAuthSession } from './features/auth/useAuthSession'
import { FaqSection } from './features/site/FaqSection'
import { HomeSections } from './features/site/HomeSections'
import { SiteHeader } from './features/site/SiteHeader'
import { useFaqContent } from './features/site/useFaqContent'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useSiteContent } from './features/site/useSiteContent'
import { TaskManagerSection } from './features/tasks/TaskManagerSection'
import { useTaskManager } from './features/tasks/useTaskManager'

interface ScrollMenuItem {
  id: string
  label: string
  isExternal?: boolean
  href?: string
}

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const cmsHref = `${baseUrl}admin/`
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState('hero')
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, number>>({})

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const content = useSiteContent(baseUrl)
  const homeSections = useHomeSectionsContent(baseUrl)
  const faqContent = useFaqContent(baseUrl)
  const {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    signIn,
    signInAdmin,
    createUsername,
    signOut,
  } = useAuthSession()

  const isAdmin = Boolean(session?.roles?.includes('admin'))
  const {
    metrics,
    requestLogs,
    userActivity,
    loading: adminLoading,
    error: adminError,
    loadAdminData,
  } = useAdminDashboard(isAuthenticated && isAdmin)
  const {
    tasks,
    taskTitle,
    taskDifficulty,
    taskGoal,
    tasksLoading,
    taskError,
    submitting,
    workingTaskId,
    goalInput,
    plannedTaskDifficulty,
    plannedTasks,
    planning,
    creatingPlanTasks,
    deletingAllTasks,
    plannerStatus,
    storyPoints,
    goalProgress,
    pendingCount,
    setTaskTitle,
    setTaskDifficulty,
    setTaskGoal,
    setGoalInput,
    setPlannedTaskDifficulty,
    loadTasks,
    handleCreateTask,
    handleSetTaskDifficulty,
    handleUpdateTaskStatus,
    handleToggleTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleGeneratePlan,
    handleCreatePlannedTasks,
    handleResetGeneratedPlan,
  } = useTaskManager(isAuthenticated, session?.subject ?? null)

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks])
  const completionPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const pendingLabel = Math.max(tasks.length - completedCount, 0)

  const menuItems = useMemo<ScrollMenuItem[]>(() => {
    const items: ScrollMenuItem[] = [
      { id: 'hero', label: 'Overview' },
      { id: 'session', label: 'Session' },
      { id: 'sections', label: 'Highlights' },
    ]

    if (isAuthenticated && isAdmin) {
      items.push({ id: 'admin-dashboard', label: 'Admin Dashboard' })
    }

    items.push(
      { id: 'task-manager', label: 'Task Manager' },
      { id: 'faq', label: 'FAQ' },
      { id: 'cms-link', label: 'Open CMS', isExternal: true, href: cmsHref },
    )

    return items
  }, [cmsHref, isAdmin, isAuthenticated])

  useEffect(() => {
    const sectionIds = menuItems.filter((item) => !item.isExternal).map((item) => item.id)
    if (!sectionIds.length) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setSectionVisibility((previous) => {
          const next = { ...previous }
          for (const entry of entries) {
            next[entry.target.id] = entry.intersectionRatio
          }
          return next
        })

        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visibleEntries[0]) {
          setActiveSectionId(visibleEntries[0].target.id)
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -20% 0px',
        threshold: [0, 0.2, 0.45, 0.65, 0.85, 1],
      },
    )

    for (const sectionId of sectionIds) {
      const node = document.getElementById(sectionId)
      if (node) {
        observer.observe(node)
      }
    }

    return () => observer.disconnect()
  }, [menuItems])

  const handleMenuJump = (sectionId: string) => {
    const node = document.getElementById(sectionId)
    if (!node) {
      return
    }

    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  const sectionStateClass = (sectionId: string) => {
    const ratio = sectionVisibility[sectionId] ?? 0
    if (ratio >= 0.55) {
      return 'section-carousel-item section-carousel-active'
    }
    if (ratio >= 0.2) {
      return 'section-carousel-item section-carousel-near'
    }
    return 'section-carousel-item section-carousel-away'
  }

  return (
    <main className="forge-grid relative min-h-screen bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 xl:px-10 2xl:px-14">
      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[2200px] flex-col gap-6">
        <section className="sticky top-2 z-40 rounded-2xl border border-zinc-500/30 bg-zinc-900/75 p-3 shadow-xl shadow-black/40 backdrop-blur-xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <p className="font-semibold text-zinc-100">
              Progress HUD: <span className="text-amber-200">{completionPercent}% complete</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-zinc-300">
              <span className="rounded-lg border border-zinc-500/40 bg-zinc-800/80 px-2 py-1">{completedCount} done</span>
              <span className="rounded-lg border border-zinc-500/40 bg-zinc-800/80 px-2 py-1">{pendingLabel} pending</span>
              <span className="rounded-lg border border-zinc-500/40 bg-zinc-800/80 px-2 py-1">
                {isAuthenticated ? `Signed in: ${session?.subject || 'user'}` : 'Signed out'}
              </span>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <nav className="sticky top-24 rounded-2xl border border-zinc-500/30 bg-zinc-900/70 p-3 shadow-xl shadow-black/40 backdrop-blur-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">On This Screen</p>
              <ul className="space-y-1.5">
                {menuItems.map((item) => {
                  const isActive = activeSectionId === item.id
                  if (item.isExternal) {
                    return (
                      <li key={item.id}>
                        <a
                          href={item.href}
                          className="block rounded-lg border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
                        >
                          {item.label}
                        </a>
                      </li>
                    )
                  }

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          handleMenuJump(item.id)
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? 'border-amber-300/40 bg-amber-500/10 text-amber-100'
                            : 'border-zinc-500/35 bg-zinc-800/70 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive && <span className="text-[10px] uppercase tracking-wide text-amber-200">On screen</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          <div className="space-y-6">
            <div id="hero" className={sectionStateClass('hero')}>
              <SiteHeader content={content} />
            </div>

            <div id="session" className={sectionStateClass('session')}>
              <SessionPanel
                isAuthenticated={isAuthenticated}
                authLoading={authLoading}
                authBusy={authBusy}
                authError={authError}
                subjectInput={subjectInput}
                currentSubject={session?.subject || ''}
                currentRoles={session?.roles || []}
                onSubjectInputChange={setSubjectInput}
                onSignIn={signIn}
                onSignInAdmin={signInAdmin}
                onCreateUsername={createUsername}
                onSignOut={signOut}
              />
            </div>

            <div id="sections" className={sectionStateClass('sections')}>
              <HomeSections content={homeSections} />
            </div>

            {isAuthenticated && isAdmin && (
              <div id="admin-dashboard" className={sectionStateClass('admin-dashboard')}>
                <AdminDashboardSection
                  loading={adminLoading}
                  error={adminError}
                  metrics={metrics}
                  requestLogs={requestLogs}
                  userActivity={userActivity}
                  onRefresh={() => {
                    void loadAdminData()
                  }}
                />
              </div>
            )}

            <div id="task-manager" className={sectionStateClass('task-manager')}>
              <TaskManagerSection
                authLocked={!isAuthenticated}
                pendingCount={pendingCount}
                storyPoints={storyPoints}
                goalProgress={goalProgress}
                tasksLoading={tasksLoading}
                taskError={taskError}
                goalInput={goalInput}
                plannedTaskDifficulty={plannedTaskDifficulty}
                planning={planning}
                creatingPlanTasks={creatingPlanTasks}
                deletingAllTasks={deletingAllTasks}
                plannerStatus={plannerStatus}
                plannedTasks={plannedTasks}
                taskTitle={taskTitle}
                taskDifficulty={taskDifficulty}
                taskGoal={taskGoal}
                submitting={submitting}
                tasks={tasks}
                workingTaskId={workingTaskId}
                onRefresh={loadTasks}
                onGoalInputChange={setGoalInput}
                onPlannedTaskDifficultyChange={setPlannedTaskDifficulty}
                onGeneratePlan={handleGeneratePlan}
                onCreatePlannedTasks={handleCreatePlannedTasks}
                onTaskTitleChange={setTaskTitle}
                onTaskDifficultyChange={setTaskDifficulty}
                onTaskGoalChange={setTaskGoal}
                onCreateTask={handleCreateTask}
                onSetTaskDifficulty={handleSetTaskDifficulty}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onDeleteAllTasks={handleDeleteAllTasks}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onResetGeneratedPlan={handleResetGeneratedPlan}
              />
            </div>

            <div id="faq" className={sectionStateClass('faq')}>
              <FaqSection content={faqContent} />
            </div>
          </div>
        </div>

        {showBackToTop && (
          <button
            type="button"
            className="fixed bottom-6 right-6 z-50 rounded-full border border-zinc-400/40 bg-zinc-900/85 px-4 py-3 text-xs font-semibold text-zinc-100 shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-0.5 hover:bg-zinc-800"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            ↑ Top
          </button>
        )}
      </div>
    </main>
  )
}

export default App
