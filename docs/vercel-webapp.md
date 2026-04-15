# Webapp basis op Vercel

Dit is de eerste stap om Badschoppen als webapp online te zetten.

De keuzes die nu zijn vastgelegd:

- eerst webapp, daarna pas PWA
- hostingplatform: Vercel
- login: Supabase auth per gebruiker
- offline-focus voor later: boodschappenlijst zichtbaar houden

## 1. Productie-URL kiezen

Mijn advies:

- primaire naam: `badschoppen`
- verwachte Vercel-url: `https://badschoppen.vercel.app`

Als die naam al bezet is, kies dan een rustige variant zoals:

- `badschoppen-app`
- `badschoppen-web`
- `badschoppen-familie`

Voor nu is een `vercel.app`-domein voldoende. Een eigen domein is pas later nodig als je dat echt wilt.

## 2. Environment variables

De webapp gebruikt dezelfde Supabase-variabelen als de desktopversie:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Voorbeeldbestand:

- [.env.production.example](/Users/arthurkooyker/Documents/Programmeren/badschoppen/.env.production.example)

Deze waarden zet je later in Vercel bij:

- `Project Settings`
- `Environment Variables`

## 3. Vercel-config

Voor dit project is al een basisbestand toegevoegd:

- [vercel.json](/Users/arthurkooyker/Documents/Programmeren/badschoppen/vercel.json)

Dat houdt de setup expliciet op `Vite` en netjes voor webdeploy.

## 4. Build-uitkomst

De webbuild wordt al lokaal gemaakt met:

```bash
npm run build
```

De output komt in:

- `/Users/arthurkooyker/Documents/Programmeren/badschoppen/dist`

Dat is precies wat Vercel voor de webapp nodig heeft.

## 5. Wat nog niet in deze stap zit

Deze eerste stap zet alleen de webbasis klaar.

Nog niet meegenomen:

- mobiele responsive verfijning
- PWA / installeren op iPhone
- offline caching

## Aanbevolen vervolgstap

Na deze voorbereiding is de volgende stap:

1. Vercel-project aanmaken
2. repository of map koppelen
3. env vars invullen
4. eerste deploy uitvoeren

Daarna kunnen we de responsive webinterface gericht gaan verbeteren.
