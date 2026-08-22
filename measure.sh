#!/usr/bin/env bash
# Measures what the skill catalog actually costs per turn.
#
# Claude Code injects the YAML frontmatter of every SKILL.md it can see into the
# system prompt on every turn. Bodies are loaded on demand; frontmatter is not.
# So the catalog cost is the sum of the frontmatter blocks, and that is what this
# measures. Run it against any skills root.
#
#   ./measure.sh ~/.claude/skills          # the live catalog
#   ./measure.sh ~/.claude/skills-lib      # what it looked like before
#
set -u
ROOT="${1:-$HOME/.claude/skills}"

entries=0
fm_bytes=0
body_bytes=0
biggest_name=""
biggest_size=0

for dir in "$ROOT"/*/; do
  file="$dir/SKILL.md"
  [ -f "$file" ] || continue

  # frontmatter only: everything between the first --- and the next ---
  fm=$(awk 'NR==1 && /^---/ {p=1; next} p && /^---/ {exit} p' "$file")
  size=${#fm}
  body=$(wc -c < "$file")

  entries=$((entries + 1))
  fm_bytes=$((fm_bytes + size))
  body_bytes=$((body_bytes + body))

  if [ "$size" -gt "$biggest_size" ]; then
    biggest_size=$size
    biggest_name=$(basename "$dir")
  fi
done

# ~3.6 bytes per token is the observed ratio for English prose plus YAML keys.
# Deliberately conservative; the real tokenizer usually lands slightly lower.
tokens=$((fm_bytes * 10 / 36))

printf 'root                %s\n' "$ROOT"
printf 'entries             %d\n' "$entries"
printf 'catalog bytes       %d      (frontmatter, injected every turn)\n' "$fm_bytes"
printf 'catalog tokens      ~%d\n' "$tokens"
printf 'body bytes          %d      (loaded on demand, not per turn)\n' "$body_bytes"
[ "$entries" -gt 0 ] && printf 'mean per entry      %d bytes\n' "$((fm_bytes / entries))"
printf 'largest entry       %s (%d bytes)\n' "$biggest_name" "$biggest_size"
