# Converting a flat catalog

## 1. Measure first

```bash
./measure.sh ~/.claude/skills
```

If the catalog is under a few thousand bytes this is not your problem and you should stop here.

## 2. Find every root

The number of skills you think you have and the number the model sees are usually different. Skills arrive from more than one directory, and some of those directories belong to other tools.

In my case `opencode` was scanning `~/.agents/skills/**` as a second root, which is how a catalog of 12 entries presented as 103. Fixed by pinning the roots explicitly in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "skills": { "paths": ["~/.claude/skills"] }
}
```

plus `OPENCODE_DISABLE_EXTERNAL_SKILLS=1`.

Check for symlinks before you plan any file moves. 51 of my 95 skill folders were symlinks into `~/.agents/skills` and `lucid-od-skills`, which are repos I do not own. Those cannot be copied into a router's `refs/` without forking someone else's work, so routers point at them rather than absorbing them.

## 3. Group by trigger, not by topic

The instinct is to group by subject matter. The thing that matters is whether one description can carry the trigger vocabulary for the whole group without becoming ambiguous against its neighbours.

Seven routers came out of 89 skills:

| router | absorbs |
|---|---|
| `design-ui` | anti-slop gating, brand tokens, UI/UX, critique, website build and audit, chat UI, screenshot replication, images, video, visual reports |
| `growth-seo` | every `*-cro` skill, SEO audit, schema, site architecture, programmatic SEO, A/B testing, analytics, ASO, pricing, referral, churn, launch, ads |
| `outreach-sales` | cold email, sequences, deliverability, the lead lifecycle, client delivery, sales enablement, contract prep, revops |
| `writing-copy` | copywriting, editing, content strategy, social, marketing psychology, prose scoring |
| `research` | the deep-research routes and the due-diligence report engine |
| `infra-meta` | orchestration, multi-model council, subagent delegation, browser automation, shipping discipline |
| `lucid-internal` | the personal CLI, session housekeeping, calendar, notifications |

Three skills stayed unrouted because they are loaded reflexively rather than by category, and burying them behind a router would add a hop to the most frequent path.

## 4. Write the router body as pointers

The body is a table. Each row names a skill, one line on when it applies, and the path to read.

Keep it short. The body is the thing that loads when the router fires, so a bloated body reintroduces the cost you just removed, only later.

## 5. Move, do not delete

```bash
mkdir -p ~/.claude/skills-lib
mv ~/.claude/skills/<skill> ~/.claude/skills-lib/<skill>
```

`skills-lib` is not a skills root, so nothing in it reaches the catalog. Everything is still on disk, still readable by path, and the control arm of any future benchmark is a single `mv` away.

## 6. Project-scope what is project-specific

84 Swift skill bodies totalling 1.34 MB were global for no reason. Moving them to a project-scoped `swift-ios` router in the two repos that use Swift removed ~52 KB and 84 entries from the global catalog outright, which is a bigger win than routing them would have been.

If a skill only applies inside one repo, scope it there. That beats routing.

## 7. Measure again

```bash
./measure.sh ~/.claude/skills
```

Then benchmark accuracy, which is the step I have not completed. See [`BENCHMARK.md`](BENCHMARK.md).
