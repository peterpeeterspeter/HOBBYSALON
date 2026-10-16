# Self-hosted fonts

Latin woff2 files for Quicksand and Lato, used via `next/font/local` in `src/app/layout.tsx`.

Self-hosted to avoid intermittent CI failures from `next/font/google` fetching Google Fonts at build time.

| Family    | Weights        | CSS variable       |
|-----------|----------------|--------------------|
| Quicksand | 400, 500, 600, 700 | `--font-quicksand` |
| Lato      | 300, 400, 700, 900 | `--font-lato`      |

Licensed under the SIL Open Font License 1.1 (see `OFL.txt` in each family folder).
Source files sourced from [@fontsource](https://fontsource.org/).
