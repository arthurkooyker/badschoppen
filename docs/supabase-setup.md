# Supabase setup voor Badschoppen

Dit project bevat nu een eerste database-opzet voor synchronisatie tussen:

- jouw MacBook
- de MacBook van je partner
- jullie iPhones

## Wat jij in Supabase moet doen

1. Open je Supabase-project.
2. Ga naar `SQL Editor`.
3. Maak een nieuwe query aan.
4. Open het bestand [schema.sql](/Users/arthurkooyker/Documents/Programmeren/badschoppen/supabase/schema.sql).
5. Kopieer de volledige inhoud van dat bestand naar de Supabase SQL Editor.
6. Voer de query uit.

Daarmee worden de tabellen, relaties, triggers en basis-RLS policies aangemaakt.

## Extra stap als je `schema.sql` al eerder hebt uitgevoerd

Omdat de app nu ook huishouden-aanmaak vanuit de frontend ondersteunt, is er een extra SQL-patch toegevoegd:

1. Open [household-bootstrap.sql](/Users/arthurkooyker/Documents/Programmeren/badschoppen/supabase/household-bootstrap.sql).
2. Kopieer de volledige inhoud naar een nieuwe query in `SQL Editor`.
3. Voer die query uit.

Daarmee worden de benodigde RPC-functies aangemaakt voor:

- huishouden aanmaken
- huishoudens van de ingelogde gebruiker ophalen

## Extra patch bij foutmelding tijdens upload

Als je bij het uploaden van recepten een fout krijgt, voer dan ook dit bestand uit:

1. Open [rls-fix.sql](/Users/arthurkooyker/Documents/Programmeren/badschoppen/supabase/rls-fix.sql)
2. Kopieer de volledige inhoud naar een nieuwe query in `SQL Editor`
3. Voer die query uit

Deze patch zorgt dat de huishoud-check in de RLS-policies correct werkt tijdens inserts, updates en uploads.

## Wat er daarna in VS Code nodig is

1. Kopieer [.env.example](/Users/arthurkooyker/Documents/Programmeren/badschoppen/.env.example) naar een lokaal `.env` bestand.
2. Vul daarin je eigen Supabase project-URL en anon key in.
3. Daarna kunnen we de echte codekoppeling bouwen.

## Belangrijk

- Ik kan niet automatisch direct in jouw Supabase-dashboard wijzigingen uitvoeren.
- Ik kan wel:
  - SQL-bestanden voor je maken
  - migraties voorbereiden
  - TypeScript code schrijven voor de koppeling
  - je exact vertellen wat je in Supabase moet uitvoeren
