import { GoalDiagram } from '../../components/GoalDiagram'
import type { Task } from '../../types'

interface GoalDiagramsSectionProps {
  goal: string
  tasks: Task[]
}

export function GoalDiagramsSection({ goal, tasks }: GoalDiagramsSectionProps) {
  return (
    <section className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-3 text-xl font-semibold text-white">Goal Diagrams</h2>
      <p className="mb-4 text-sm text-zinc-300">
        Live gameboard view of your current task list.
      </p>

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-300">
          Add tasks to generate your gameboard path.
        </p>
      ) : (
        <article className="rounded-2xl border border-zinc-500/35 bg-zinc-800/75 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{goal}</h3>
            <span className="text-xs text-zinc-400">
              {tasks.filter((task) => task.completed).length}/{tasks.length} complete
            </span>
          </div>
          <GoalDiagram goal={goal} tasks={tasks} />
        </article>
      )}
    </section>
  )
}
