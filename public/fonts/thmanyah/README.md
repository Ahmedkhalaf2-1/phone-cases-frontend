# Thmanyah (ثمانية) — Arabic typeface

The Arabic storefront (`<html lang="ar">`) uses **Thmanyah Sans**.

The `.woff2` files are licensed (thmanyah Font License) and are therefore
**git-ignored** — they are not committed to the repository. Place these files
from the official download (`thmanyah typeface/thmanyahsans/woff2/`) in this
folder on every machine that serves the site (local, VPS):

- `thmanyahsans-Light.woff2`   (300)
- `thmanyahsans-Regular.woff2` (400)
- `thmanyahsans-Medium.woff2`  (500)
- `thmanyahsans-Bold.woff2`    (700)

Files in `public/` are served at runtime, so copying them needs no rebuild.
If they are missing, Arabic falls back to the platform's Arabic system font.
The `@font-face` rules and font stack live in `src/app/globals.css`
("Arabic typography").
