# dinspel.eu landing page

Small static landing page for `dinspel.eu`, based on the Clota Design handoff in
`design_handoff_dinspel_landing/`.

## Local preview

```powershell
python -m http.server 8788 --bind 127.0.0.1
```

Open `http://127.0.0.1:8788/`.

## Cloudflare Pages

- Build command: none
- Output directory: `/`
- Deploy root: this repository root

The page is plain HTML/CSS/JS and self-hosts the JetBrains Mono font files in
`fonts/`.
