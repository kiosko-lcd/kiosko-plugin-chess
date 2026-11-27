# Vendored: chess.js 1.4.0

Third-party code, not written for this plugin. Do not edit: replace it with
a new upstream release instead.

- `chess.js`: `dist/esm/chess.js` of the npm package `chess.js@1.4.0`.
- `chess.d.ts`: `dist/types/chess.d.ts` of the same package.

Both are byte for byte as published (tarball sha1
`edc1439492d1a0d7f530ba72b2b5398baece28a1`, upstream commit `ce1ff9e9`):

```
76c7c34f0e2e9ab076521a5d6fe786a9cce537bb1b6f29d32a9c9970b5b232d2  chess.js
29f09463bf7aedb31c93b4f692b9001eb5529b9dcc52829a1c0d5895e2f2e8f8  chess.d.ts
```

No changes. The last line of `chess.js`, `//# sourceMappingURL=chess.js.map`,
points to a source map that is not copied; nothing here uses it.

Licence: BSD-2-Clause, Copyright (c) 2025, Jeff Hlywa. The header is in both
files and the full text in the plugin's NOTICE. Upstream:
https://github.com/jhlywa/chess.js

Why vendored and not a dependency: in Kiosko's development and CI layout the
plugin is a workspace of `../kiosko`, whose install only provides what its own
lockfile already has.
