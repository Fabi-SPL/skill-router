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

A router's `description` is doing more work than a normal skill's, because it has to fire for every trigger in its category. In practice that means the description is mostly a trigger vocabulary, and it is the only part you can afford to spend bytes on.

The mean entry grew from 691 to 927 bytes for exactly this reason. Fewer, denser entries beat many thin ones.

## What is measured and what is not

Measured, and reproducible from the script above:

- catalog entry count, before and after
- catalog bytes injected per turn, before and after
- total body bytes, which is the number that kills naive merging

Reported in my own session logs, not independently reproducible here:

- total delivered tokens per turn fell from roughly 48,200 to 12,150, a 75% cut, after both the catalog restructure and a separate `CLAUDE.md` cleanup. Two changes, one number. The catalog-only figure is the 86% above.

**Not measured. This is the honest gap:**

- **Routing accuracy is unproven.** Whether the model reliably picks the right skill through a router, as often as it did with a flat catalog, has not been benchmarked successfully. The one attempt cost $255.56 across 91 sessions and produced uninterpretable output for two compounding reasons, both mine, both documented in [`BENCHMARK.md`](BENCHMARK.md).

Until that number exists, the claim this repo can make is about token cost, not about behaviour being unchanged.

## Files

| | |
|---|---|
| [`measure.sh`](measure.sh) | the measurement, run it against any skills root |
| [`METHOD.md`](METHOD.md) | how to convert a flat catalog, step by step |
| [`BENCHMARK.md`](BENCHMARK.md) | the failed accuracy benchmark, what went wrong, what the corrected design is |
| [`NOTES.md`](NOTES.md) | the raw record: every finding, in order, including the wrong turns |
