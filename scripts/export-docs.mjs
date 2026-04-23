import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const exportDir = path.join(rootDir, "docs", "export")
const htmlDir = path.join(exportDir, "html")

const documents = [
  { input: "docs/design.md", output: "design.html", title: "設計書" },
  { input: "docs/specification.md", output: "specification.html", title: "仕様書" },
  { input: "docs/user-manual.md", output: "user-manual.html", title: "取扱説明書" },
  { input: "docs/security-check.md", output: "security-check.html", title: "セキュリティチェック報告書" },
]

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function renderInline(value) {
  let html = escapeHtml(value)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>")
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return html
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const output = []
  let paragraph = []
  let listTag = null
  let inCodeBlock = false
  let codeLang = ""
  let codeLines = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`)
    paragraph = []
  }

  const closeList = () => {
    if (!listTag) return
    output.push(`</${listTag}>`)
    listTag = null
  }

  const flushCodeBlock = () => {
    if (!inCodeBlock) return
    const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""
    output.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
    inCodeBlock = false
    codeLang = ""
    codeLines = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line.startsWith("```")) {
      flushParagraph()
      closeList()
      if (inCodeBlock) {
        flushCodeBlock()
      } else {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      closeList()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      closeList()
      const level = headingMatch[1].length
      output.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`)
      continue
    }

    const unorderedMatch = line.match(/^- (.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listTag !== "ul") {
        closeList()
        listTag = "ul"
        output.push("<ul>")
      }
      output.push(`<li>${renderInline(unorderedMatch[1])}</li>`)
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listTag !== "ol") {
        closeList()
        listTag = "ol"
        output.push("<ol>")
      }
      output.push(`<li>${renderInline(orderedMatch[1])}</li>`)
      continue
    }

    paragraph.push(line.trim())
  }

  flushParagraph()
  closeList()
  flushCodeBlock()

  return output.join("\n")
}

function wrapDocument(title, bodyHtml, sourcePath) {
  const generatedAt = new Date().toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm;
    }

    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #52607a;
      --line: #d6dde8;
      --paper: #ffffff;
      --accent: #0f766e;
      --accent-soft: #ecfeff;
      --code: #0f172a;
      --code-bg: #f8fafc;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Yu Gothic UI", "Meiryo", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 36%),
        linear-gradient(180deg, #f8fafc, #eef6ff 24%, #ffffff 100%);
    }

    main {
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
      padding: 22mm 18mm;
      background: var(--paper);
    }

    header {
      border-bottom: 2px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      letter-spacing: 0.08em;
      color: var(--accent);
      text-transform: uppercase;
      font-weight: 700;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      line-height: 1.3;
      page-break-after: avoid;
    }

    h1 {
      margin: 0;
      font-size: 30px;
    }

    h2 {
      margin-top: 28px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--line);
      font-size: 22px;
    }

    h3 {
      margin-top: 24px;
      font-size: 18px;
    }

    p, li {
      font-size: 14px;
      line-height: 1.85;
    }

    p {
      margin: 10px 0;
    }

    ul, ol {
      margin: 10px 0 10px 22px;
      padding: 0;
    }

    li + li {
      margin-top: 4px;
    }

    code {
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 0.92em;
      background: var(--code-bg);
      color: var(--code);
      padding: 0.15em 0.35em;
      border-radius: 6px;
    }

    pre {
      overflow: hidden;
      margin: 16px 0;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--code-bg);
      white-space: pre-wrap;
      word-break: break-word;
    }

    pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }

    a {
      color: #0f766e;
      text-decoration: none;
    }

    .meta {
      margin-top: 12px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Kakeibo App</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">生成元: ${escapeHtml(sourcePath)} | 生成日時: ${escapeHtml(generatedAt)}</p>
    </header>
    ${bodyHtml}
  </main>
</body>
</html>`
}

async function main() {
  await fs.mkdir(htmlDir, { recursive: true })

  for (const document of documents) {
    const inputPath = path.join(rootDir, document.input)
    const outputPath = path.join(htmlDir, document.output)
    const markdown = await fs.readFile(inputPath, "utf8")
    const bodyHtml = markdownToHtml(markdown)
    const fullHtml = wrapDocument(document.title, bodyHtml, document.input)
    await fs.writeFile(outputPath, fullHtml, "utf8")
    console.log(`Generated ${path.relative(rootDir, outputPath)}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
