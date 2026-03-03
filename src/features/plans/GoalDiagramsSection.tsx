import { GoalDiagram } from '../../components/GoalDiagram'
import type { Task } from '../../types'

interface GoalDiagramsSectionProps {
  goal: string
  tasks: Task[]
}

export function GoalDiagramsSection({ goal, tasks }: GoalDiagramsSectionProps) {
  return (
    <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
      <h2 className="mb-3 text-xl font-semibold text-white">Goal Diagrams</h2>
      <p className="mb-4 text-sm text-slate-300">
        Live gameboard view of your current task list.
      </p>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-300">
          Add tasks to generate your gameboard path.
        </p>
      ) : (
        <article className="rounded-2xl border border-white/15 bg-slate-800/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{goal}</h3>
            <span className="text-xs text-slate-400">
              {tasks.filter((task) => task.completed).length}/{tasks.length} complete
            </span>
          </div>
          <GoalDiagram goal={goal} tasks={tasks} />
        </article>
      )}
    </section>
  )
}
