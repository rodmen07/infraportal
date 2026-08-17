import { Badge } from '../../components/ui/Badge'
import {
  CONTROL_COUNT,
  COVERED_CELLS,
  SOC2_CONTROLS,
  TOTAL_CELLS,
  type CloudCell,
} from './soc2Controls'

// The SOC 2 control × cloud matrix (SOC2-MATRIX-1): one row per control, one
// column per cloud, every count derived from the model. A gap cell renders as
// an explicit statement with a caution badge — coverage is claimed cell by
// cell, never implied by the row existing.

function cellContent(cell: CloudCell) {
  if (!cell.covered) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="caution">gap</Badge>
        <span className="text-text-muted">{cell.note}</span>
      </div>
    )
  }
  return (
    <div>
      <p className="text-text-secondary">{cell.impl}</p>
      <p className="mt-1 font-mono text-scale-2xs text-text-subtle">{cell.evidence}</p>
    </div>
  )
}

export function Soc2ControlMatrix() {
  const gaps = TOTAL_CELLS - COVERED_CELLS
  return (
    <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
      <div className="border-b border-zinc-700/40 px-5 py-4">
        <h2 className="text-base font-semibold text-white">SOC 2 Type II — Control Coverage Matrix</h2>
        <p className="mt-0.5 text-xs text-text-subtle">
          {CONTROL_COUNT} controls · {COVERED_CELLS} of {TOTAL_CELLS} control-cloud cells covered
          by Terraform, CI policy, or documented practice — each cell cites its evidence ·{' '}
          {gaps} recorded {gaps === 1 ? 'gap' : 'gaps'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold text-text-muted">Control</th>
              <th scope="col" className="w-2/5 px-4 py-2.5 font-semibold text-text-muted">GCP</th>
              <th scope="col" className="w-2/5 px-4 py-2.5 font-semibold text-text-muted">AWS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {SOC2_CONTROLS.map((control) => (
              <tr key={control.id} className="align-top transition hover:bg-zinc-800/20">
                <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-normal">
                  <span className="font-mono font-semibold text-amber-300">{control.id}</span>
                  <span className="ml-2 text-text-subtle">{control.name}</span>
                </th>
                <td className="px-4 py-2.5">{cellContent(control.gcp)}</td>
                <td className="px-4 py-2.5">{cellContent(control.aws)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
