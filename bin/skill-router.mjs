#!/usr/bin/env node
// skill-router — measure what a Claude Code skill catalog costs per turn, and
// route it down without deleting anything.
//
//   skill-router measure [root]        what the catalog costs right now
//   skill-router plan    [root]        propose routers, write router-plan.json
//   skill-router apply   [plan]        create routers, move originals to the library
//   skill-router revert  [root]        put everything back
//
// Default root is ~/.claude/skills. Nothing is ever deleted: apply moves the
// originals to a sibling skills-lib/, which is not a skills root, so it reaches
// no catalog and stays readable by path.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { measure } from '../src/catalog.mjs'
import { plan as makePlan } from '../src/plan.mjs'
import { apply, revert, ops } from '../src/apply.mjs'

const argv = process.argv.slice(2)
const cmd = argv.find((a) => !a.startsWith('-'))
const rest = argv.filter((a) => a !== cmd && !a.startsWith('-'))
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

const DEFAULT_ROOT = join(homedir(), '.claude', 'skills')
const n = (x) => x.toLocaleString('en-US')
const pct = (before, after) => (before ? `${Math.round((1 - after / before) * 100)}%` : '—')

function cmdMeasure(root) {
  const m = measure(root)
  if (flag('json')) return console.log(JSON.stringify(m, (k, v) => (k === 'skills' ? undefined : v), 2))
  console.log(`root                ${m.root}`)
  console.log(`entries             ${n(m.entries)}`)
  console.log(`catalog bytes       ${n(m.catalogBytes)}      (frontmatter, injected every turn)`)
  console.log(`catalog tokens      ~${n(m.catalogTokens)}`)
  console.log(`body bytes          ${n(m.bodyBytes)}      (loaded on demand, not per turn)`)
  console.log(`mean per entry      ${n(m.meanEntry)} bytes`)
  if (m.largest) console.log(`largest entry       ${m.largest.name} (${n(m.largest.bytes)} bytes)`)
  if (m.symlinks) console.log(`symlinked           ${m.symlinks}      (moved as links, never copied)`)
  if (m.catalogBytes < 4000) console.log(`\nUnder ~4 KB. This is not your problem yet.`)
}

function cmdPlan(root) {
  const p = makePlan(measure(root), {
    threshold: Number(opt('threshold', 0.09)),
    maxSize: Number(opt('max-size', 14)),
    minSize: Number(opt('min-size', 3)),
  })
  const out = resolve(opt('out', 'router-plan.json'))
  writeFileSync(out, JSON.stringify(p, null, 2), 'utf8')

  console.log(`                    entries    catalog bytes    approx tokens`)
  console.log(
    `before          ${String(n(p.before.entries)).padStart(10)}   ${String(n(p.before.catalogBytes)).padStart(14)}   ${String(n(p.before.catalogTokens)).padStart(14)}`,
  )
  console.log(
    `after           ${String(n(p.after.entries)).padStart(10)}   ${String(n(p.after.catalogBytes)).padStart(14)}   ${String(n(p.after.catalogTokens)).padStart(14)}`,
  )
  console.log(
    `                ${pct(p.before.entries, p.after.entries).padStart(10)}   ${pct(p.before.catalogBytes, p.after.catalogBytes).padStart(14)}   ${pct(p.before.catalogTokens, p.after.catalogTokens).padStart(14)}`,
  )
  console.log()
  for (const r of p.routers) {
    console.log(`  ${r.name}${r.renamedFrom ? `  (renamed from ${r.renamedFrom})` : ''}`)
    console.log(`    ${r.members.map((m) => m.dir).join(', ')}`)
  }
  if (p.unrouted.length) console.log(`\n  unrouted (${p.unrouted.length}): ${p.unrouted.map((s) => s.dir).join(', ')}`)

  console.log(`\nwrote ${out}`)
  console.log(
    `\nThe grouping is mechanical and the descriptions are drafts. A router's\n` +
      `description has to fire for every trigger in its category, which is the\n` +
      `one part worth editing by hand. Edit the plan, then:\n\n` +
      `  skill-router apply ${basename(out)} --yes`,
  )
}

function cmdApply(planPath) {
  const file = resolve(planPath || 'router-plan.json')
  if (!existsSync(file)) throw new Error(`no plan at ${file} — run \`skill-router plan\` first`)
  const p = JSON.parse(readFileSync(file, 'utf8'))
  const root = resolve(opt('root', p.root))
  const lib = resolve(opt('lib', join(dirname(root), `${basename(root)}-lib`)))

  if (!flag('yes')) {
    const planned = ops(p, { root, lib })
    for (const op of planned) {
      if (op.kind === 'write') console.log(`  write  ${op.path}`)
      else console.log(`  move   ${op.from}\n      -> ${op.to}${op.symlink ? '   (symlink)' : ''}`)
    }
    console.log(`\n${planned.length} operations. Nothing written. Re-run with --yes to apply.`)
    return
  }

  const { applied } = apply(p, { root, lib, dryRun: false })
  console.log(`applied ${applied.length} operations`)
  console.log(`library  ${lib}`)
  console.log(`\nRestart your client so it re-reads the catalog, then:\n  skill-router measure ${root}`)
  console.log(`\nUndo with:\n  skill-router revert ${root}`)
}

function cmdRevert(root) {
  console.log(`reverted ${revert({ root })} operations in ${root}`)
}

try {
  const root = resolve(rest[0] || DEFAULT_ROOT)
  if (cmd === 'measure' || !cmd) cmdMeasure(root)
  else if (cmd === 'plan') cmdPlan(root)
  else if (cmd === 'apply') cmdApply(rest[0])
  else if (cmd === 'revert') cmdRevert(root)
  else {
    console.error(`unknown command: ${cmd}\n`)
    console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
    process.exit(1)
  }
} catch (err) {
  console.error(`skill-router: ${err.message}`)
  process.exit(1)
}
