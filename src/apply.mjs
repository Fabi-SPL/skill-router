// Turns a plan into files, reversibly.
//
// The rule from METHOD.md is move, do not delete. Every original ends up in a
// sibling `skills-lib/` that is not a skills root, so it reaches no catalog and
// is still readable by path. Symlinked skills are moved as links, never copied,
// because absorbing a repo you do not own is how you end up forking it.

import { mkdirSync, writeFileSync, readFileSync, renameSync, rmSync, existsSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'

const STATE = '.skill-router-state.json'

// rename() fails across devices, which happens the moment someone's skills live
// on a different mount than their home directory.
function move(from, to) {
  mkdirSync(dirname(to), { recursive: true })
  try {
    renameSync(from, to)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    cpSync(from, to, { recursive: true, verbatimSymlinks: true })
    rmSync(from, { recursive: true, force: true })
  }
}

function routerBody(router) {
  const rows = router.members
    .map((m) => {
      const one = (m.description || '').split(/(?<=[.!?])\s/)[0].slice(0, 160)
      return `| \`${m.dir}\` | ${one} | \`${m.dir}/SKILL.md\` |`
    })
    .join('\n')
  return `
Read the file for the skill that fits, then follow it. Paths are relative to the
skills library, a sibling of this skills root.

| skill | when it applies | read |
|---|---|---|
${rows}

If none of them fit, say so rather than picking the nearest one.
`.trimStart()
}

// Every move happens before every write. A router is usually named after the
// skill at the centre of its group, so `seo-site` can absorb a skill called
// `seo-site`. Writing the router first would land it inside that skill's own
// directory, clobber its SKILL.md, and then move the wreckage to the library.
// Moving first means the name is free by the time the router needs it.
export function ops(plan, { root, lib }) {
  const moves = []
  const writes = []
  for (const r of plan.routers) {
    writes.push({ kind: 'write', path: join(root, r.name, 'SKILL.md'), router: r.name })
    for (const m of r.members) {
      moves.push({
        kind: 'move',
        from: join(root, m.dir),
        to: join(lib, m.dir),
        symlink: !!m.symlink,
      })
    }
  }
  return [...moves, ...writes]
}

export function apply(plan, { root, lib, dryRun }) {
  const planned = ops(plan, { root, lib })

  // Fail before touching anything rather than half way through.
  const problems = []
  for (const op of planned) {
    if (op.kind === 'move') {
      if (!existsSync(op.from)) problems.push(`missing: ${op.from}`)
      if (existsSync(op.to)) problems.push(`already in library: ${op.to}`)
    }
  }
  if (problems.length) throw new Error(`refusing to apply:\n  ${problems.join('\n  ')}`)

  if (dryRun) return { applied: [], planned }

  mkdirSync(lib, { recursive: true })
  const done = []
  try {
    for (const op of planned) {
      if (op.kind === 'write') {
        const r = plan.routers.find((x) => x.name === op.router)
        const md = `---\nname: ${r.name}\ndescription: ${r.description}\n---\n\n${routerBody(r)}`
        mkdirSync(dirname(op.path), { recursive: true })
        writeFileSync(op.path, md, 'utf8')
      } else {
        move(op.from, op.to)
      }
      done.push(op)
    }
  } catch (err) {
    rollback(done)
    throw err
  }

  writeFileSync(
    join(root, STATE),
    JSON.stringify({ root, lib, ops: done, at: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return { applied: done, planned }
}

function rollback(done) {
  for (const op of [...done].reverse()) {
    try {
      if (op.kind === 'move') move(op.to, op.from)
      else rmSync(dirname(op.path), { recursive: true, force: true })
    } catch {
      // Best effort. The state file is the record of what did land.
    }
  }
}

export function revert({ root }) {
  const file = join(root, STATE)
  if (!existsSync(file)) throw new Error(`nothing to revert: no ${STATE} in ${root}`)
  const state = JSON.parse(readFileSync(file, 'utf8'))
  rollback(state.ops)
  rmSync(file, { force: true })
  return state.ops.length
}
