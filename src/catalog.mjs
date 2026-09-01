// Reads a skills root the way Claude Code reads it, and prices it.
//
// Only the YAML frontmatter of each SKILL.md reaches the system prompt, and it
// reaches it on every turn. Bodies are read on demand. So the number that
// matters is the sum of the frontmatter blocks, not the sum of the files. This
// module is the Node port of measure.sh, plus the parsing the planner needs.

import { readdirSync, readFileSync, statSync, lstatSync } from 'node:fs'
import { join } from 'node:path'

// ~3.6 bytes per token is the observed ratio for English prose plus YAML keys.
// Deliberately conservative; the real tokenizer usually lands slightly lower.
export const BYTES_PER_TOKEN = 3.6

export const tokens = (bytes) => Math.round(bytes / BYTES_PER_TOKEN)

// Everything between the first `---` and the next one. Byte-exact, because the
// byte count is the whole point.
function splitFrontmatter(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { frontmatter: '', body: text }
  const end = lines.indexOf('---', 1)
  if (end === -1) return { frontmatter: '', body: text }
  return {
    frontmatter: lines.slice(1, end).join('\n'),
    body: lines.slice(end + 1).join('\n'),
  }
}

// Minimal YAML: top-level `key: value` with folded continuations. Skills only
// ever carry a handful of scalar keys, so a full parser would be dead weight.
function parseFrontmatter(fm) {
  const out = {}
  let key = null
  for (const line of fm.split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(line)
    if (m) {
      key = m[1]
      out[key] = m[2].trim()
    } else if (key && /^\s+\S/.test(line)) {
      out[key] += ' ' + line.trim()
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].replace(/^["']|["']$/g, '')
  return out
}

export function readSkill(dir, name) {
  const file = join(dir, 'SKILL.md')
  let text
  try {
    if (!statSync(file).isFile()) return null
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const { frontmatter } = splitFrontmatter(text)
  const meta = parseFrontmatter(frontmatter)
  return {
    name: meta.name || name,
    dir: name,
    path: dir,
    description: meta.description || '',
    // The catalog entry is the frontmatter block itself. Buffer.byteLength,
    // not .length, because descriptions carry non-ASCII more often than you
    // would guess.
    catalogBytes: Buffer.byteLength(frontmatter, 'utf8'),
    fileBytes: Buffer.byteLength(text, 'utf8'),
    isSymlink: lstatSync(dir).isSymbolicLink(),
  }
}

export function scan(root) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    throw new Error(`cannot read skills root: ${root}`)
  }
  const skills = []
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue
    const s = readSkill(join(root, e.name), e.name)
    if (s) skills.push(s)
  }
  return skills.sort((a, b) => b.catalogBytes - a.catalogBytes)
}

export function measure(root) {
  const skills = scan(root)
  const catalogBytes = skills.reduce((n, s) => n + s.catalogBytes, 0)
  const bodyBytes = skills.reduce((n, s) => n + s.fileBytes, 0)
  return {
    root,
    entries: skills.length,
    catalogBytes,
    catalogTokens: tokens(catalogBytes),
    bodyBytes,
    meanEntry: skills.length ? Math.round(catalogBytes / skills.length) : 0,
    largest: skills[0] ? { name: skills[0].dir, bytes: skills[0].catalogBytes } : null,
    symlinks: skills.filter((s) => s.isSymlink).length,
    skills,
  }
}
