# skill-router

When I measured this in August 2026, Claude Code injected the YAML frontmatter of every skill it could see into the system prompt, on every turn, whether or not the turn had anything to do with that skill. With 89 skills installed that was 61,533 bytes of catalog before the conversation started.

This is the pattern I used to get it to 8,351 bytes without deleting a single skill.

```
                    entries    catalog bytes    approx tokens
before                  89           61,533           17,092
after                    9            8,351            2,319
                       -90%             -86%             -86%
```

Update, November 2026: the catalog has grown to 13 entries and 11,373 bytes as new areas were added. [`METHOD.md`](METHOD.md) covers what broke in between and the nightly check that guards it now.

Reproduce both numbers with [`measure.sh`](measure.sh):

```bash
./measure.sh ~/.claude/skills-lib    # the originals, untouched
./measure.sh ~/.claude/skills        # the live catalog
```

Where this matters has moved since August. Claude Code's documentation now describes a cap on the listing itself (`skillListingBudgetFraction`, 1% of the context window by default, with the descriptions of the least used skills dropped first). On stock Claude Code the bytes are bounded either way, and a router mostly decides which descriptions survive. A harness that lists every skill in full, such as opencode or a custom agent loop on the API, still pays the whole catalog on every turn. Mine is one of those, and the numbers on this page come from it.

Routing accuracy: the August run said it held. The corrected November run says it costs a little. One task per skill, three catalogs, same model, scored down to the file:

```
flat catalog      98 entries   75,842 chars   80/89   89.9%
mixed catalog    123 entries   93,167 chars   77/89   86.5%
routed catalog    16 entries   14,151 chars   74/89   83.1%
```

That is 6.7 points under the flat catalog at a fifth of the size. The bar was written before the run: within 5 points holds, more than 10 under is a regression. So this result is inconclusive, and I report it as that. Once the model names the right router it finds the right file 74 times out of 76. Eleven of the fifteen misses picked one of two skills whose descriptions tell the model to load them before anything else. A router's broad description loses to that where a specific one did not.

[`BENCHMARK.md`](BENCHMARK.md) has the bar, the misses and the limits. The August numbers (40/40 against 50/51) are kept there too, with the reasons they could not see this.

## Use it on your own catalog

```bash
npx github:Fabi-SPL/skill-router measure          # what yours costs right now
npx github:Fabi-SPL/skill-router plan             # propose routers, price the result
npx github:Fabi-SPL/skill-router apply router-plan.json --yes
```

Node 18+, no dependencies. Default root is `~/.claude/skills`; pass another as
the first argument.

`plan` clusters the catalog by shared trigger vocabulary and writes an editable
`router-plan.json` with the projected numbers. `apply` creates the routers and
moves every original into a sibling `skills-lib/`, which is not a skills root,
so it reaches no catalog and stays readable by path. Nothing is deleted, and
`revert` puts it all back:

```bash
npx github:Fabi-SPL/skill-router revert
```

**The clustering is mechanical; the grouping is not.** On the 89-skill catalog
above the automatic pass reaches 35 entries and 19,114 bytes, a 69% cut. The
hand-grouped version in this README reaches 9 entries and 8,351 bytes, 86%.
That gap is judgement about which triggers can share one description without
becoming ambiguous, and the plan file is where you apply it. Editing the drafted
descriptions before `apply` is the whole job.

## The thing that makes it work

The obvious move is to merge related skills into one file. That is a trap. The 89 skill bodies total **1,192,261 bytes**, roughly 330,000 tokens. Concatenating them produces a file too large to ever load.

The move that works is that **frontmatter and body have different lifecycles**. Frontmatter ships every turn. The body is read only when the skill is invoked. So the router is a skill whose frontmatter carries the trigger vocabulary for a whole category, and whose body is a short table of pointers to the original files.

```
before                              after

skills/                             skills/
  cold-email/SKILL.md                 outreach-sales/SKILL.md   <- 1 catalog entry
  email-sequence/SKILL.md             ...
  lead-desk/SKILL.md                skills-lib/                 <- 0 catalog entries
  lead-magnets/SKILL.md               cold-email/SKILL.md
  lead-replies/SKILL.md               email-sequence/SKILL.md
  lead-scraper/SKILL.md               lead-desk/SKILL.md
  sales-enablement/SKILL.md           lead-magnets/SKILL.md
  revops/SKILL.md                     ...
  ... 8 catalog entries              all bodies intact, read on demand
```

Nothing is deleted. `skills-lib/` holds all 89, symlinks included. The router body names the file to read, and the model reads it.

## What the frontmatter has to do

A router's `description` is doing more work than a normal skill's, because it has to fire for every trigger in its category. In practice that means the description is mostly a trigger vocabulary, and it is the only part worth spending bytes on.

The mean entry grew from 691 to 927 bytes for exactly this reason. Fewer, denser entries beat many thin ones.

## What is measured and what is not

Measured and reproducible from the scripts in this repo:

- catalog entry count and catalog bytes injected per turn, before and after
- total body bytes, which is the number that kills naive merging
- the August routing numbers, scored from the surviving session transcripts with [`rescore.mjs`](rescore.mjs)

Reported from my own setup, not independently reproducible here:

- the November routing run. Its tasks are written from my own skill files and its calls ran through my own harness. The bar and the scoring rules are in [`BENCHMARK.md`](BENCHMARK.md) in full.
- total delivered tokens per turn fell from roughly 48,200 to 12,150, a 75% cut, after both the catalog restructure and a separate `CLAUDE.md` cleanup. Two changes, one number. The catalog-only figure is the 86% above.

The honest limits on the November accuracy number:

- one run, one model, one catalog. 89 tasks resolve a gap of about 10 points, not 3
- the model was asked to name one skill. In real use it can load two, and the two skills that took most of the misses are written to be loaded beside another one
- each task message was written from the skill's own body, which favours the flat catalog
- the catalog was the whole system prompt. A real one sits inside a prompt many times larger

All four are expanded in [`BENCHMARK.md`](BENCHMARK.md), along with the two mistakes that made the August run cost $255.56 instead of single-digit dollars.

## Files

| | |
|---|---|
| [`bin/skill-router.mjs`](bin/skill-router.mjs) | the CLI: measure, plan, apply, revert |
| [`src/`](src) | catalog parsing, the clustering, and the reversible file surgery |
| [`measure.sh`](measure.sh) | the original measurement in bash, kept because the numbers above came from it |
| [`rescore.mjs`](rescore.mjs) | scores routing accuracy from the saved session transcripts |
| [`METHOD.md`](METHOD.md) | how to convert a flat catalog, step by step |
| [`BENCHMARK.md`](BENCHMARK.md) | the accuracy result, its limits, and what the run cost |
| [`NOTES.md`](NOTES.md) | the raw record: every finding, in order, including the wrong turns |

## License

Apache 2.0. Use it, fork it, ship it inside something commercial. Keep the
copyright line and the [`NOTICE`](NOTICE), and say where it came from.
