# Mascot illustrations

Drop a transparent `.webp` or `.png` here named after one of the `IllustrationName`
values in `src/components/ui/brand.tsx` (for example `welcome.webp`). It is picked up at
build time and shown wherever that illustration is used. Screens render a plain icon
fallback for any name that has no file yet.

`scripts/generate-illustrations.sh` generates the full set from the mascot reference.
