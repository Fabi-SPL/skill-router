# The accuracy benchmark

Shrinking the catalog is only worth doing if the model still picks the right thing. That is the number this file is about.

There are two runs. The August one came first, had four holes, and said nothing was lost. The November one closes the holes and says a little was.

## The corrected run, November 2026

This is the run the last section of this file asks for: name, do not perform. Instrument asserted first. A flat control arm. One account. Scored at both hops. One task per skill instead of 23 tasks over 7 routers.

Three catalogs, each used as the whole system prompt, the same 108 messages, the same model (`claude-opus-5-5`):

| arm | what it lists | entries | chars |
|---|---|---|---|
| `flat` | every skill under its own description, no routers | 98 | 75,842 |
| `old` | routers and originals side by side, the state my harness had drifted back to | 123 | 93,167 |
| `routed` | 7 routers and 9 skills listed as themselves | 16 | 14,151 |

The 108 messages are one per routed skill (89), one per skill listed as itself (9), and 10 that no skill fits. The model answers with the skill it would load. When it names a router it gets that router's body and one more call to name the file.

| arm | reached the right skill | named it directly | through a router | controls | named a skill where none fits |
|---|---|---|---|---|---|
| `flat` | **80/89, 89.9%** | 80 | none listed | 7/9 | 0/10 |
| `old` | **77/89, 86.5%** | 44 | 33 of 41 | 6/9 | 1/10 |
| `routed` | **74/89, 83.1%** | 0 | 74 of 76 | 9/9 | 1/10 |

"33 of 41" reads: 41 answers named the right router, 33 of those then named the right file.

### The bar, written before the first model call

| check | bar | result | |
|---|---|---|---|
| primary | routed within 5.0 points of flat holds, more than 10.0 under is a regression | 6.7 under | **inconclusive** |
| second hop | 95% of right-router answers name the right file | 74/76, 97.4% | clears |
| restraint | at most one more of the 10 none-messages answered with a skill than flat | 1 against 0 | clears |
| controls | at least as many of the 9 as flat, minus one | 9 against 7 | clears |

Inconclusive is the result. It is not a pass with a footnote. Paired by task: 73 reached in both arms, 7 only in flat, 1 only in routed, 8 in neither. An exact sign test on those 8 gives p = 0.07.

### Where the misses went

Routed missed 15:

- 6 answered `design-doctrine` and 5 answered `message-core`. Both are listed as themselves, and both descriptions tell the model to load them before any work of their kind
- 2 named a different router
- 2 named the right router and then a neighbouring file

With every skill listed under its own description, those two skills took one task between them. Against a router's broader description they took eleven. That is the cost this run found, and it sits in how a "load me first" description competes with a category description, more than in the second hop.

Flat missed 9, and 5 of them were design skills collapsing into one neighbour. The design cluster is the confusable one in every arm. That matches what the literature reports: confusability among similar skills, more than catalog size alone, drives selection errors (Li, arXiv 2601.04748).

### What this run does not show

**One run, one model, one catalog.** The catalog is mine. 89 tasks resolve a gap of about 10 points, not 3.

**Hand-grouped routers, not the CLI's plan.** The 7 routers in this run are grouped by hand, and every row carries the full path to its file. `skill-router plan` proposes its own groups, 12 on the same library, and writes paths relative to the library. That output was not benchmarked.

**A single pick.** The model was asked to name one skill. In use it can load two, and the two skills that took most of the misses are written to be loaded beside another one. This run cannot tell a model that would load both from one that stops at the first.

**The messages favour flat.** Each was written by the model from the skill's own body, with the frontmatter cut off. It shares more words with that skill's own description than with a router's.

**The catalog was the whole system prompt.** A real one sits inside a prompt many times larger.

**Use after loading.** Whether a skill that is reached then gets used well is not measured.

**It is not reproducible from this repo.** The tasks come from my own skill files and the calls ran through my own harness. The bar and the scoring above are the whole method.

### What it cost

454 routing calls and 98 to write the tasks. 9.3M cache-read tokens and 46k output tokens across the three arms, against 105M and 689k in August.

## The August run

Kept as it was written. Read it knowing the run above contradicts its headline.

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

### What the August run does and does not show

It shows that collapsing the catalog by an order of magnitude did not cost routing accuracy at this sample size. 40/40 against 50/51 is not a detectable regression.

Four things it does not show, and I would rather write them down than have someone find them:

**The baseline arm is not a pristine before.** It carries the routers *plus* the 91 old entries, because un-ringing that bell would have meant moving files back mid-run. So the comparison is a 103-entry catalog against a 12-entry one, not a flat catalog against a routed one. Both arms could reach the routers. What changed between them is how much noise surrounded the right answer.

**The expected answer is a router name in both arms.** So this measures whether the model finds the right *category* entry, not whether it then reads down to the right file underneath. The second hop is exercised by the fallback trace below, once, by hand.

**n is small.** 91 sessions sounds like a lot and is not, because it is 23 tasks across 7 routers. That is thin per-router coverage, and 100% against 98% at this size rules out a large regression, not a small one.

**Arm labels drifted from the run-time count.** The arms are named for 103 and 12 entries. The harness counted 100 and 9 routable entries when it actually ran. The label stuck from an earlier measurement and I left it rather than rewrite the result files.

The fallback path, probed directly rather than through the harness:

> Asked the model to load `seo-audit`, a skill that no longer exists as a catalog entry. The harness returned `Unknown skill`. The model located the file under the `growth-seo` router, read it, and answered correctly.

### What August cost, and why that was avoidable

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

### What a corrected run looks like, as written in August

1. **Name, do not perform.** One-line request, model responds with the skill it would load, no tools, short max tokens.
2. **Assert the instrument first.** Require a non-zero invocation count on a known-good trace before the suite proceeds.
3. **Restore the flat catalog for the control arm.** `skills-lib/` back into `skills/`, so the baseline is actually flat and the expected answer can be the original skill name rather than the router name.
4. **Pin the pool.** The 20x Max pool injects no prompt hooks; the 5x pool injects nine. The same session gets a materially different system prompt depending on which pool failover lands it on, so a run that drifts between pools is measuring two things. Record the pool per session.
5. **Score three ways.** Exact skill match, correct-router match, and no-skill-when-none-applies.
6. **More tasks per router.** 23 across 7 is too thin to say anything per category.

Estimated cost of that run is single-digit dollars. The expensive part was never the measurement.

That run is the first section of this file. Step 4 became one pinned account, and step 6 became one task per skill.
