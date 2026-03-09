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
  const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950">
      {file && (
        <div className="border-b border-zinc-800/60 px-4 py-2">
          <span className="text-[11px] text-zinc-500">{file}</span>
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
