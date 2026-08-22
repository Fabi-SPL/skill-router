# NOTES

The raw record, in order, from my session logs. Wrong turns included, because the
wrong turns are where the method came from.

`HQ2` below is a second Claude-Code-compatible client running against the same
`~/.claude/skills/` folder. It is in here because the catalog cost is a property
of the folder, not of one client, so both saw the same win.


## 2026-08-21

**Actual system prompt is 210KB, 74% from 224 skills**  
`finding`

Dumping the model's actual system prompt revealed a massive 210KB payload. A staggering 74% of this (approximately 38,000 tokens) consists of 224 skill descriptions, injected in full on every turn regardless of task. This 'skill catalog' is a much larger restriction and steer than the previously identified behavioral rules.

**Different Max pools inject different prompt hooks**  
`finding`

It was discovered that the 20x Max pool has no prompt hooks at all, while the 5x Max pool has nine. This means the same session receives a materially different system prompt depending on which pool failover lands it on, impacting model behavior and making benchmark results pool-dependent.

**Massive Skill Catalog Bloat Found in System Prompt**  
`finding`

Analysis revealed the system prompt injects 224 skill descriptions, totaling ~38k tokens, on every turn. This constitutes 75% of the total system prompt load, significantly impacting context window and model behavior.

**CLAUDE.md is 37KB and Always Injected**  
`finding`

The `CLAUDE.md` file, containing the model's constitution, is 37KB (approximately 9,300 tokens) and is injected into the system prompt on every single turn. This makes it the largest single item after the skill catalog.

**Adopted Skill Router Strategy for Massive Catalog Reduction**  
`problem_fix`

Adopted the user's strategy of merging related skills into single 'router' skills per category (e.g., all CRO skills into one `cro` skill). This approach reduces the skill catalog from 218 entries (150KB) to approximately 20 entries (~3KB), significantly improving token efficiency and routing clarity by eliminating the need for the model to choose between many similar skills.

**Naive Skill Merging Avoided Due to Context Bomb Risk**  
`problem_fix`

Directly merging skill bodies by concatenation was identified as a 'context bomb' risk, as 84 Swift skill bodies alone total 1.34 MB (~336,000 tokens). The revised solution is to create router skills whose bodies are short tables of pointers, loading original skill files on demand, preserving content without context bloat.

**Swift/iOS Skills Project-Scoped, Global Catalog Reduced**  
`decision`

Decided to project-scope Swift/iOS skills. A `swift-ios` router was built for the two projects that actually use Swift, with the original files moved to a local vendor directory outside any skills root. This removed ~52KB and 84 entries from the global skill catalog, making them available only when relevant.

**51 Skill Folders are Symlinks to External Repos**  
`finding`

Discovered that 51 of the 95 skill folders are symlinks, pointing to `~/.agents/skills` (45) and a second local skills repo (6). This means skill folders cannot be copied into `refs/` for router skills, requiring pointer files instead to avoid forking external repos.

**Skill Catalog Restructured to 10 Entries (7 Routers)**  
`file_change`

The global skill catalog was restructured from 91 entries to 10, comprising 7 router skills and 3 top-level unrouted skills (`lucid-caveman`, `message-core`, `product-template`). All 88 original skills are preserved in `~/.claude/skills-lib/`, with symlinks intact, ensuring no content loss while drastically reducing catalog size.

**Skill Catalog Changes Apply to Both Claude Code and HQ2**  
`finding`

The skill catalog restructuring, including the creation of router skills and reduction of entries, applies universally to both Claude Code and HQ2. This is because `~/.claude/skills/` serves as the shared global skills folder for both environments.

**HQ2 Skill Catalog Fixed: Reduced from 103 to 12 Entries**  
`problem_fix`

HQ2's skill catalog was reduced from 103 entries to 12. The issue was `opencode` scanning `~/.agents/skills/**` as a second root. This was fixed by setting `OPENCODE_DISABLE_EXTERNAL_SKILLS=1` and explicitly configuring `skills.paths: ['~/.claude/skills']` in `~/.config/opencode/opencode.jsonc`, leaving `.agents/skills` out.

**Total Delivered Tokens Reduced by 75% Per Turn**  
`finding`

After skill restructuring and CLAUDE.md cleanup, the total delivered tokens per turn were reduced by 75%, from approximately 48,200 to 12,150 tokens. This significant reduction frees up context window space and improves model efficiency.

**Routing Accuracy of New Router Skills Unproven**  
`open_question`

The routing accuracy of the newly implemented router skills remains unproven. Initial benchmark attempts failed due to a bug in the scoring script (wrong case/field for skill invocation), yielding uninterpretable results. Further testing is required to confirm if the model correctly invokes skills via the new router structure.

> Resolved after this atom was written. The scorer bug corrupted the scoring, not the collection, so the sessions were re-scored from disk: 40/40 on the 103-entry catalog, 50/51 on the 12-entry one. See [`BENCHMARK.md`](BENCHMARK.md).

**Router Structure Confirmed Working via Direct Probe**  
`finding`

A direct probe confirmed the router structure is working as intended. When asked to load a specific skill (e.g., `seo-audit`) directly, the harness returned an 'Unknown skill' error, but the model successfully recovered by finding the file under the correct router skill (`growth-seo`), reading it, and answering.

