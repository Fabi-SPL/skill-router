// Proposes a routed catalog from a flat one.
//
// Grouping is the part that needs judgement, so this does not pretend to
// finish it. It does the mechanical half: tokenise every description, cluster
// by shared trigger vocabulary, and price the result. What comes out is an
// editable plan, not a decision. The description it drafts for each router is
// a starting point assembled from the vocabulary its members actually use.

import { tokens } from './catalog.mjs'

const STOP = new Set(
  ('a about after all also an and any are as at be because been before being but by can could did do does doing for from had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up use used uses using very was we were what when where which while who whom why will with would you your yours skill skills claude code file files thing things need needs want wants make makes making get gets getting new user users work works working task tasks help helps run runs load loads')
    .split(' '),
)

const words = (s) =>
  (s.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,}/g) || [])
    .map((w) => w.replace(/[.-]+$/, ''))
    .filter((w) => w.length > 2 && !STOP.has(w))

function vector(skill) {
  const v = new Map()
  const add = (w, weight) => v.set(w, (v.get(w) || 0) + weight)
  // The folder name is the strongest signal about what a skill is for, so it
  // outweighs prose that may be mostly trigger-word padding.
  for (const w of words(skill.dir.replace(/[-_]/g, ' '))) add(w, 3)
  for (const w of words(skill.description)) add(w, 1)
  let norm = 0
  for (const n of v.values()) norm += n * n
  norm = Math.sqrt(norm) || 1
  for (const [w, n] of v) v.set(w, n / norm)
  return v
}

const cosine = (a, b) => {
  let sum = 0
  const [small, large] = a.size < b.size ? [a, b] : [b, a]
  for (const [w, n] of small) sum += n * (large.get(w) || 0)
  return sum
}

// Average-link agglomerative clustering. Stops on threshold or size cap,
// whichever bites first. Deterministic: ties break on the earlier index.
function cluster(skills, { threshold, maxSize }) {
  const vectors = skills.map(vector)
  let groups = skills.map((s, i) => ({ members: [i], vecs: [vectors[i]] }))

  for (;;) {
    let best = null
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (groups[i].members.length + groups[j].members.length > maxSize) continue
        let sum = 0
        for (const a of groups[i].vecs) for (const b of groups[j].vecs) sum += cosine(a, b)
        const score = sum / (groups[i].vecs.length * groups[j].vecs.length)
        if (score >= threshold && (!best || score > best.score)) best = { i, j, score }
      }
    }
    if (!best) break
    const { i, j } = best
    groups[i] = {
      members: [...groups[i].members, ...groups[j].members],
      vecs: [...groups[i].vecs, ...groups[j].vecs],
    }
    groups = groups.filter((_, k) => k !== j)
  }
  return groups.map((g) => g.members.map((i) => skills[i]))
}

// The terms the whole group shares, most distinctive first. This is the raw
// material for the trigger vocabulary.
function salient(members, limit, idf) {
  const freq = new Map()
  for (const m of members) {
    const seen = new Set([...words(m.dir.replace(/[-_]/g, ' ')), ...words(m.description)])
    for (const w of seen) freq.set(w, (freq.get(w) || 0) + 1)
  }
  return [...freq.entries()]
    .map(([w, n]) => [w, n * (idf.get(w) ?? 1)])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w)
}

// Words like `whenever` or `someone` show up in most descriptions. Down-weight
// by how many skills use them, so what survives is what marks a group out.
function inverseFrequency(skills) {
  const df = new Map()
  for (const s of skills) {
    for (const w of new Set([...words(s.dir.replace(/[-_]/g, ' ')), ...words(s.description)]))
      df.set(w, (df.get(w) || 0) + 1)
  }
  const idf = new Map()
  for (const [w, n] of df) idf.set(w, Math.log(skills.length / n) + 0.1)
  return idf
}

// Names come from folder names, not from description prose, because prose is
// mostly trigger padding and picks words like `mentions` or `anything`. Two
// terms that share a stem (lead / leads) read as a stutter, so collapse them.
function draftName(members, terms) {
  const fromDirs = new Set()
  for (const m of members) for (const w of words(m.dir.replace(/[-_]/g, ' '))) fromDirs.add(w)
  const stem = (w) => w.replace(/(ies|es|s)$/, '')
  const picked = []
  for (const t of terms) {
    if (!fromDirs.has(t)) continue
    if (picked.some((p) => stem(p) === stem(t))) continue
    picked.push(t)
    if (picked.length === 2) break
  }
  return picked.join('-') || members[0].dir
}

// A router's description has to fire for every trigger in its category, so it
// is mostly trigger vocabulary. Denser and fewer beats thin and many. This
// drafts one; it is meant to be edited before apply.
function draftDescription(members, terms) {
  const covers = members.map((m) => m.dir).join(', ')
  const triggers = terms.slice(0, 24).join(', ')
  return (
    `Use for ${terms.slice(0, 4).join(', ')} work. ` +
    `Covers: ${covers}. ` +
    `Trigger words: ${triggers}.`
  )
}

export function plan(measured, { threshold = 0.09, maxSize = 14, minSize = 3 } = {}) {
  const groups = cluster(measured.skills, { threshold, maxSize })
  const idf = inverseFrequency(measured.skills)

  const routers = []
  const unrouted = []
  for (const members of groups) {
    if (members.length < minSize) {
      unrouted.push(...members)
      continue
    }
    const terms = salient(members, 30, idf)
    const name = draftName(members, terms)
    const description = draftDescription(members, terms)
    routers.push({
      name,
      description,
      // Frontmatter is `name:` + `description:` plus the two `---` fences the
      // measurement counts between. Estimated the same way it will be measured.
      catalogBytes: Buffer.byteLength(`name: ${name}\ndescription: ${description}`, 'utf8'),
      members: members.map((m) => ({ dir: m.dir, description: m.description, symlink: m.isSymlink })),
    })
  }

  // A router name that collides with a skill it does not absorb would clobber
  // it on apply. Rename rather than fail, and say so in the plan.
  const taken = new Set(measured.skills.map((s) => s.dir))
  const used = new Set()
  for (const r of routers) {
    const absorbs = new Set(r.members.map((m) => m.dir))
    let n = r.name
    let i = 2
    while ((taken.has(n) && !absorbs.has(n)) || used.has(n)) n = `${r.name}-${i++}`
    if (n !== r.name) r.renamedFrom = r.name
    r.name = n
    used.add(n)
  }

  const afterBytes =
    routers.reduce((n, r) => n + r.catalogBytes, 0) +
    unrouted.reduce((n, s) => n + s.catalogBytes, 0)

  return {
    generatedBy: 'skill-router plan',
    root: measured.root,
    settings: { threshold, maxSize, minSize },
    before: {
      entries: measured.entries,
      catalogBytes: measured.catalogBytes,
      catalogTokens: measured.catalogTokens,
    },
    after: {
      entries: routers.length + unrouted.length,
      catalogBytes: afterBytes,
      catalogTokens: tokens(afterBytes),
    },
    routers,
    unrouted: unrouted.map((s) => ({ dir: s.dir, catalogBytes: s.catalogBytes })),
  }
}
