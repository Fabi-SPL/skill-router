#!/usr/bin/env node
// Scores the skill-routing benchmark from the surviving session transcripts.
//
// The original harness scored live and got every arm wrong, because it looked
// for `part.tool === 'skill'` with `input.name`. The real shape is `'Skill'`
// with `input.skill`. The scoring was broken; the sessions were not. They are
// still on disk, so the result is recoverable without paying for another run.
//
//   node rescore.mjs [path-to-opencode-local.db]
//
// Default DB path is the opencode local store on this machine. Requires Node 22+
// for the built-in node:sqlite. Opens read-only.

import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DB = process.argv[2] || join(homedir(), '.local/share/opencode/opencode-local.db')

// Each arm ran the same task set against a different catalog size. Session
// titles are `skill-routing-<label>-<expected-skill>`, which is the only place
// the expected answer survived the broken scorer.
const ARMS = [
  { label: 'baseline-103', catalog: 103 },
  { label: 'baseline-v2', catalog: 103 },
  { label: 'routers-12', catalog: 12 },
  { label: 'routers-v2', catalog: 12 },
  { label: 'routers-on', catalog: 12 },
]

const db = new DatabaseSync(DB, { readOnly: true })
const sessions = db
  .prepare("SELECT id, title FROM session WHERE title LIKE 'skill-routing-%'")
  .all()
const partsFor = db.prepare(
  'SELECT data FROM part WHERE message_id IN (SELECT id FROM message WHERE session_id = ?)',
)

const agg = Object.fromEntries(
  ARMS.map((a) => [a.label, { ...a, total: 0, invoked: 0, correct: 0, misses: [] }]),
)

for (const s of sessions) {
  const rest = s.title.replace(/^skill-routing-/, '')
  const arm = ARMS.find((a) => rest.startsWith(a.label + '-'))
  if (!arm) continue
  const expected = rest.slice(arm.label.length + 1)
  const a = agg[arm.label]
  a.total++

  const called = []
  for (const p of partsFor.all(s.id)) {
    let d
    try {
      d = JSON.parse(p.data)
    } catch {
      continue
    }
    if (d?.type !== 'tool') continue
    if (String(d.tool ?? '').toLowerCase() !== 'skill') continue
    const name = d?.state?.input?.skill ?? d?.state?.input?.name
    if (typeof name === 'string') called.push(name)
  }

  if (called.length) a.invoked++
  if (called.includes(expected)) a.correct++
  else a.misses.push({ expected, called })
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '-')

console.log('arm             catalog  tasks  invoked a skill  hit expected')
let base = { t: 0, c: 0 }
let rout = { t: 0, c: 0 }
for (const { label } of ARMS) {
  const a = agg[label]
  if (!a.total) continue
  console.log(
    label.padEnd(16) +
      String(a.catalog).padEnd(9) +
      String(a.total).padEnd(7) +
      (a.invoked + ' ' + pct(a.invoked, a.total)).padEnd(17) +
      a.correct + '/' + a.total + '  ' + pct(a.correct, a.total),
  )
  const bucket = label.startsWith('baseline') ? base : rout
  bucket.t += a.total
  bucket.c += a.correct
}

console.log('')
console.log(`baseline (103 entries)  ${base.c}/${base.t}  ${pct(base.c, base.t)}`)
console.log(`routers  (12 entries)   ${rout.c}/${rout.t}  ${pct(rout.c, rout.t)}`)

for (const { label } of ARMS) {
  for (const m of agg[label].misses) {
    console.log(
      `\nmiss in ${label}: expected ${m.expected}, invoked [${m.called.join(', ') || 'nothing'}]`,
    )
  }
}

const cost = db
  .prepare(
    'SELECT COUNT(*) c, SUM(tokens_cache_read) cr, SUM(tokens_output) o, SUM(cost) cost' +
      " FROM session WHERE title LIKE 'skill-routing-%'",
  )
  .get()
console.log(
  `\nwhat this cost: ${cost.c} sessions, ${Number(cost.cr).toLocaleString('en-US')} cache-read tokens, ` +
    `${Number(cost.o).toLocaleString('en-US')} output tokens, $${Number(cost.cost).toFixed(2)}`,
)
