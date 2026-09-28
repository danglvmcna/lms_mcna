#!/usr/bin/env bash
# Generate the mascot illustrations used across the app with the Codex CLI.
#
# Needs:
#   - codex CLI signed in (`codex login` or OPENAI_API_KEY in the environment)
#   - the mascot reference image at public/brand/mascot.png (override with MASCOT=path)
#
# Output: src/assets/illustrations/<name>.png (transparent). Each file is picked up at build time by
# src/components/ui/brand.tsx, so no code change is needed. Existing files are skipped; pass
# names as arguments to (re)generate only those, e.g. `scripts/generate-illustrations.sh welcome mail`.
set -euo pipefail

cd "$(dirname "$0")/.."
MASCOT="${MASCOT:-public/brand/mascot.png}"
OUT="src/assets/illustrations"
MODEL="${CODEX_MODEL:-gpt-5.6-terra}"

if [[ ! -f "$MASCOT" ]]; then
  echo "Mascot reference not found at $MASCOT" >&2
  exit 1
fi
mkdir -p "$OUT"

STYLE="Match the attached mascot exactly: same character design, proportions, colours and rendering style. \
Keep the illustration clean and friendly for children, teenagers and college students. \
Use only the MCNA palette as accents: indigo #4F46E5, violet #8B5CF6, cyan #6EE7F9 and soft slate greys. \
One simple scene, centered, with generous empty margin around it. No text, no letters, no logos, no UI screenshots, \
no background colour or scenery: the background must be fully transparent. Soft, even lighting and a gentle drop shadow under the character only."

ALL="welcome explore live-class progress celebrate mail lock study waiting search chat inbox teach"

scene_for() {
  case "$1" in
    welcome) echo "The mascot waving hello with a big friendly smile, one hand raised, standing next to a laptop." ;;
    explore) echo "The mascot looking through a small telescope at floating course cards, curious and excited." ;;
    live-class) echo "The mascot sitting at a laptop showing a video call with a teacher, waving at the screen." ;;
    progress) echo "The mascot happily climbing three rounded steps toward a small flag at the top." ;;
    celebrate) echo "The mascot jumping with both arms up, small confetti pieces around it, celebrating success." ;;
    mail) echo "The mascot holding a large envelope with a key peeking out of it, looking helpful." ;;
    lock) echo "The mascot holding a big friendly key next to a padlock, looking confident about security." ;;
    study) echo "The mascot reading an open book at a small desk with a laptop, focused and calm." ;;
    waiting) echo "The mascot sitting patiently holding an hourglass, relaxed smile, a small clock nearby." ;;
    search) echo "The mascot holding a magnifying glass up to its eye, searching curiously." ;;
    chat) echo "The mascot with two rounded speech bubbles above it, raising a hand to ask a question." ;;
    inbox) echo "The mascot holding an empty tray with a small bell, content that everything is read." ;;
    teach) echo "The mascot as a teacher standing beside a small whiteboard with simple shapes, pointing with a marker." ;;
    *) echo "" ;;
  esac
}

if [[ $# -gt 0 ]]; then names="$*"; else names="$ALL"; fi

for name in $names; do
  scene="$(scene_for "$name")"
  if [[ -z "$scene" ]]; then
    echo "Unknown illustration: $name" >&2
    continue
  fi
  target="$OUT/$name.png"
  if [[ -f "$target" && $# -eq 0 ]]; then
    echo "skip $name (exists)"
    continue
  fi
  echo "generating $name…"
  codex exec \
    --model "$MODEL" \
    --sandbox workspace-write \
    --skip-git-repo-check \
    --image "$MASCOT" \
    "Generate one image and save it as a 1024x1024 PNG with a transparent background at $target. \
Scene: $scene $STYLE Do not modify any other file."
done

echo "Done. Review the images in $OUT, then commit them."
