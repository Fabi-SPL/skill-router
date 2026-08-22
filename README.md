# skill-router

Claude Code injects the YAML frontmatter of every skill it can see into the system prompt, on every turn, whether or not the turn has anything to do with that skill. With 89 skills installed that is 61,533 bytes of catalog before the conversation starts.

This is the pattern I used to get it to 8,351 bytes without deleting a single skill.

```
                    entries    catalog bytes    approx tokens
before                  89           61,533           17,092
after                    9            8,351            2,319
                       -90%             -86%             -86%
```

Reproduce both numbers with [`measure.sh`](measure.sh):

```bash
./measure.sh ~/.claude/skills-lib    # the originals, untouched
./measure.sh ~/.claude/skills        # the live catalog
```

Routing accuracy held. Same 23 prompts, same model, two catalog sizes:

```
103-entry catalog   40/40   100%
12-entry catalog    50/51    98%
```

The single miss invoked no skill rather than the wrong one. Reproduce with [`rescore.mjs`](rescore.mjs), and read [`BENCHMARK.md`](BENCHMARK.md) for what that number does not cover, which matters as much as the number.

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
- routing accuracy across both catalog sizes, scored from the surviving session transcripts

Reported from my own session logs, not independently reproducible here:

- total delivered tokens per turn fell from roughly 48,200 to 12,150, a 75% cut, after both the catalog restructure and a separate `CLAUDE.md` cleanup. Two changes, one number. The catalog-only figure is the 86% above.

The honest limits on the accuracy number:

- the baseline arm carries the routers alongside the 91 old entries, so it is a 103-entry catalog against a 12-entry one, not a flat catalog against a routed one
- the expected answer is a router name in both arms, so this measures finding the right category, not reading down to the right file underneath
- 23 tasks across 7 routers is thin per-router coverage, and 100% against 98% at this size rules out a large regression, not a small one

All three are expanded in [`BENCHMARK.md`](BENCHMARK.md), along with the two mistakes that made the run cost $255.56 instead of single-digit dollars.

## Files

| | |
|---|---|
| [`measure.sh`](measure.sh) | the catalog measurement, run it against any skills root |
| [`rescore.mjs`](rescore.mjs) | scores routing accuracy from the saved session transcripts |
| [`METHOD.md`](METHOD.md) | how to convert a flat catalog, step by step |
| [`BENCHMARK.md`](BENCHMARK.md) | the accuracy result, its limits, and what the run cost |
| [`NOTES.md`](NOTES.md) | the raw record: every finding, in order, including the wrong turns |
