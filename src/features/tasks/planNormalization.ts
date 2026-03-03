const TITLE_MAX_LENGTH = 120

export function normalizePlanTask(task: string): string {
  const cleaned = task
    .replace(/^\s*(?:\d+[\).:-]\s*|[-*•]\s*)+/, '')
    .trim()

  const characters = Array.from(cleaned)
  if (characters.length <= TITLE_MAX_LENGTH) {
    return cleaned
  }

  return characters.slice(0, TITLE_MAX_LENGTH).join('').trimEnd()
}

export function normalizePlanTasks(tasks: string[]): string[] {
  return tasks
    .map(normalizePlanTask)
    .filter((task) => task.length > 0)
}
