# Bít illustrations

Scene illustrations of Bít, the MCNA mascot. Each `<name>.svg` here is registered at build time by
`src/components/ui/brand.tsx` and shown wherever `<Illustration name="<name>">` is used; a name
without a file falls back to a plain icon.

The SVGs are generated from shared parts by `scripts/mascot/build-illustrations.mjs`. Change the
character or a scene there and run `node scripts/mascot/build-illustrations.mjs` to rebuild the set.
