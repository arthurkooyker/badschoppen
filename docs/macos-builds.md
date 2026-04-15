# macOS builds voor Badschoppen

Dit project ondersteunt nu drie duidelijke macOS buildroutes:

- Apple Silicon (`arm64`)
- Intel (`x86_64`)
- Universal (`arm64 + Intel`)

## Beschikbare scripts

In [package.json](/Users/arthurkooyker/Documents/Programmeren/badschoppen/package.json) staan nu deze scripts:

- `npm run tauri:build:arm64`
- `npm run tauri:build:intel`
- `npm run tauri:build:universal`

## Rust targets

Voor Apple Silicon is op jouw Mac meestal al voldoende aanwezig:

```bash
rustup target list --installed
```

Voor Intel en universal moet ook het Intel-target aanwezig zijn:

```bash
rustup target add x86_64-apple-darwin
```

Voor een universal build moeten beide targets beschikbaar zijn:

- `aarch64-apple-darwin`
- `x86_64-apple-darwin`

## Aanbevolen volgorde

1. Controleer eerst of beide Rust targets aanwezig zijn:

```bash
rustup target list --installed
```

2. Voeg zo nodig het Intel-target toe:

```bash
rustup target add x86_64-apple-darwin
```

3. Maak daarna de universal build:

```bash
npm run tauri:build:universal
```

## Output

Na een succesvolle universal build staat de app normaal in de Tauri bundle-outputmap onder `src-tauri/target`.

Omdat Tauri de exacte submap per target aanmaakt, is het handig om daarna in Finder of Terminal even te zoeken op:

```bash
find src-tauri/target -path '*Badschoppen.app'
```

## Praktisch advies

- Bewaar je bestaande Intel-build en Apple Silicon-build als fallback.
- Test de universal build daarna kort op:
  - jouw Apple Silicon Mac
  - de Intel Mac van je partner
- Deel daarna pas de universal `.app` of `.zip` via AirDrop.

## Wanneer welke build gebruiken

- `arm64`: alleen voor Apple Silicon Macs
- `intel`: alleen voor Intel Macs
- `universal`: één distributiebestand voor beide Macs
