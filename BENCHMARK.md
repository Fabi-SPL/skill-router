# The accuracy benchmark, and why it produced nothing

The token numbers in the README are solid. The behavioural claim, that routing works as well as a flat catalog, is not, and this file is the reason.

## What it cost

| | |
|---|---|
| sessions burned | 91 |
| cache-read tokens per session | ~1,150,000 |
| total | ~105,000,000 tokens |
| spend | $255.56 |
| usable results | none |

## Two failures, and they compounded

**1. The prompts asked the model to do the work.**

The benchmark tasks read like `Run a full SEO audit on example.com`. The question being asked was only *which skill does the model reach for*, but the prompt invited it to actually perform the audit. Every session therefore ran a full tool-calling task: fetches, reads, analysis, a written report. That is where the 1.15M cache-read tokens per session came from.

The correct prompt asks the model to **name** the skill it would load and stop. Same signal, roughly two orders of magnitude cheaper.

**2. The scorer was looking for the wrong field.**

```diff
- entry.tool === 'skill'  &&  entry.input.name
+ entry.tool === 'Skill'  &&  entry.input.skill
```

Capital `S`, and the argument is `skill`, not `name`. Every run reported zero skill invocations. Not a low number, zero, across the board, which should have been read as an instrument fault on run one rather than a result. It was not, and the run continued.

This is the more expensive of the two mistakes, because it is the one that made the spend worthless rather than merely large. A single assertion that the scorer sees at least one invocation in a known-good trace would have caught it in the first minute.

The scorer is fixed. The runs it was scoring are gone.

## What did survive

A direct probe, run by hand rather than through the harness:

> Asked the model to load `seo-audit`, a skill that no longer exists as a catalog entry. The harness returned `Unknown skill`. The model then located the file under the `growth-seo` router, read it, and answered the question correctly.

That is one trace. It shows the fallback path works. It does not measure how often the model finds the right router unprompted, which is the thing that actually matters.

## The corrected design

1. **Name, do not perform.** Each task is a one-line request. The model responds with the skill it would load. No tools, no execution, short max tokens.
2. **Assert the instrument first.** Run one known-good trace and require a non-zero invocation count before the suite is allowed to proceed.
3. **Pin the pool.** The 20x Max pool injects no prompt hooks; the 5x pool injects nine. The same session gets a materially different system prompt depending on which pool failover lands it on, so a run that drifts between pools is measuring two different things. Record the pool per session.
4. **Both arms, same tasks.** Flat catalog restored from `skills-lib/` for the control arm, router catalog for the treatment arm.
5. **Score three ways.** Exact skill match, correct-router match, and no-skill-when-none-applies.

The estimate for a corrected run is single-digit dollars, because the expensive part was never the measurement. It was asking 91 sessions to do a day of work each.
