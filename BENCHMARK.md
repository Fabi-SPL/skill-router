# The accuracy benchmark

Shrinking the catalog is only worth doing if the model still picks the right thing. That is the number this file is about.

## Result

Same 23 prompts, same model (`claude-fable-5`), same pool, two catalog sizes, run in parallel on two ports. Later arms re-ran subsets of the same task set.

| arm | catalog entries | tasks | invoked a skill | hit the expected one |
|---|---|---|---|---|
| `baseline-103` | 103 | 23 | 23 | **23/23** |
| `baseline-v2` | 103 | 17 | 17 | **17/17** |
| `routers-12` | 12 | 23 | 22 | **22/23** |
| `routers-v2` | 12 | 18 | 18 | **18/18** |
| `routers-on` | 12 | 10 | 10 | **10/10** |

```
103-entry catalog   40/40   100%
12-entry catalog    50/51    98%
```

The one miss invoked **no skill at all** rather than the wrong one. It is a no-route, not a mis-route, which is the cheaper of the two failure modes: the model answered from its own knowledge instead of loading `infra-meta`.

Reproduce it from the surviving transcripts:

```bash
node rescore.mjs
```

## What this does and does not show

It shows that collapsing the catalog by an order of magnitude did not cost routing accuracy at this sample size. 40/40 against 50/51 is not a detectable regression.

Four things it does not show, and I would rather write them down than have someone find them:

**The baseline arm is not a pristine before.** It carries the routers *plus* the 91 old entries, because un-ringing that bell would have meant moving files back mid-run. So the comparison is a 103-entry catalog against a 12-entry one, not a flat catalog against a routed one. Both arms could reach the routers. What changed between them is how much noise surrounded the right answer.

**The expected answer is a router name in both arms.** So this measures whether the model finds the right *category* entry, not whether it then reads down to the right file underneath. The second hop is exercised by the fallback trace below, once, by hand.

**n is small.** 91 sessions sounds like a lot and is not, because it is 23 tasks across 7 routers. That is thin per-router coverage, and 100% against 98% at this size rules out a large regression, not a small one.

**Arm labels drifted from the run-time count.** The arms are named for 103 and 12 entries. The harness counted 100 and 9 routable entries when it actually ran. The label stuck from an earlier measurement and I left it rather than rewrite the result files.

The fallback path, probed directly rather than through the harness:

> Asked the model to load `seo-audit`, a skill that no longer exists as a catalog entry. The harness returned `Unknown skill`. The model located the file under the `growth-seo` router, read it, and answered correctly.

## What it cost, and why that was avoidable

```
sessions                         91
cache-read tokens       105,103,076
output tokens               689,172
spend                       $255.56
```

Two mistakes, both mine, and they compounded.

**1. The prompts asked the model to do the work.**

Tasks read like `Run a full SEO audit on example.com`. The question being asked was only *which skill does the model reach for*, but the prompt invited it to perform the audit. Every session therefore ran a full tool-calling task: fetches, reads, analysis, a written report. That is where 1.15M cache-read tokens per session came from.

The correct prompt asks the model to **name** the skill it would load and stop. Same signal, roughly two orders of magnitude cheaper.

**2. The scorer read the wrong field.**

```diff
- part.tool === 'skill'  &&  input.name
+ part.tool === 'Skill'  &&  input.skill
```

Capital `S`, and the argument is `skill`, not `name`. Every arm reported zero invocations and a 0% pass rate. Not a low number, zero, across the board, which is an instrument fault rather than a result. A single assertion that the scorer sees at least one invocation in a known-good trace would have caught it in the first minute. There was no such assertion, and the run continued for 91 sessions.

What saved it is that the bug was in the **scoring**, not the **collection**. The sessions were written to `opencode-local.db` in full, with the real tool calls in them, and the expected answer preserved in each session title. Re-scoring cost nothing. That is the only reason there is a number in this file at all, and it is luck rather than design.

## What a corrected run looks like

1. **Name, do not perform.** One-line request, model responds with the skill it would load, no tools, short max tokens.
2. **Assert the instrument first.** Require a non-zero invocation count on a known-good trace before the suite proceeds.
3. **Restore the flat catalog for the control arm.** `skills-lib/` back into `skills/`, so the baseline is actually flat and the expected answer can be the original skill name rather than the router name.
4. **Pin the pool.** The 20x Max pool injects no prompt hooks; the 5x pool injects nine. The same session gets a materially different system prompt depending on which pool failover lands it on, so a run that drifts between pools is measuring two things. Record the pool per session.
5. **Score three ways.** Exact skill match, correct-router match, and no-skill-when-none-applies.
6. **More tasks per router.** 23 across 7 is too thin to say anything per category.

Estimated cost of that run is single-digit dollars. The expensive part was never the measurement.
