import hljs from 'highlight.js/lib/core'
import rust from 'highlight.js/lib/languages/rust'
import yaml from 'highlight.js/lib/languages/yaml'
import ini from 'highlight.js/lib/languages/ini'

hljs.registerLanguage('rust', rust)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('toml', ini)

export function CodeBlock({ code, language = 'rust', file }: {
  code: string
  language?: string
  file?: string
}) {
  let highlighted: string
  try {
    highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value
  } catch {
    highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-surface-0">
      {file && (
        <div className="border-b border-zinc-800/60 px-4 py-2">
          <span className="text-scale-xs text-text-subtle">{file}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code
          className={`language-${language} text-[11.5px] leading-relaxed`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}
