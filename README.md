# Rat Watch SG

Rat Watch SG is a lightweight crowd-sourced Singapore awareness map designed for GitHub Pages and Supabase. People can click on the map, capture precise coordinates, log rat sightings or leptospirosis cases, and add details about the area and dog outcome.

## What the prototype includes

- Interactive Singapore map powered by Leaflet and OpenStreetMap
- Click-to-select coordinates with six-decimal precision
- Date and time reporting for each report
- Support for both rat sightings and leptospirosis case submissions
- Dog name and survival outcome fields for case reporting to help reduce duplicates
- Shared community reports via Supabase when configured
- Anonymous-by-default submissions
- Duplicate warnings for repeat leptospirosis case entries
- Moderation-aware schema with approved and hidden report states
- Local browser storage fallback during setup
- Awareness content about leptospirosis and why the project exists

## How to run it

Serve the folder with a small local web server, then open the app in your browser. This is the recommended approach because OpenStreetMap tile usage generally expects normal web requests rather than opening the page directly as `file://`.

The page also sets a referrer policy of `strict-origin-when-cross-origin`, which is compatible with OpenStreetMap's requirement that tile requests include a valid `Referer` header for websites and web applications.

```powershell
cd "C:\Users\GeraldineQuekCaiTing\Documents\Rat sighting"
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Supabase setup

1. Create a new Supabase project.
2. Open the SQL Editor and run [supabase-schema.sql](C:\Users\GeraldineQuekCaiTing\Documents\Rat sighting\supabase-schema.sql).
3. In Supabase project settings, copy:
   - Project URL
   - Publishable key or anon key
4. Open [config.js](C:\Users\GeraldineQuekCaiTing\Documents\Rat sighting\config.js) and replace the placeholder values:

```js
window.RATWATCH_CONFIG = {
  supabaseUrl: "https://your-project-ref.supabase.co",
  supabaseKey: "your-supabase-publishable-or-anon-key",
};
```

5. Never place your service role key in this frontend app.

## GitHub Pages deployment

1. Create a GitHub repository and push this folder to it.
2. Commit your `config.js` with the Supabase URL and publishable or anon key.
3. In GitHub, open `Settings` -> `Pages`.
4. Set the publishing source to `Deploy from a branch`.
5. Choose your main branch and the `/ (root)` folder.
6. Wait for GitHub Pages to publish the site.

The included [.nojekyll](C:\Users\GeraldineQuekCaiTing\Documents\Rat sighting\.nojekyll) file helps GitHub Pages serve the static files directly.

## Moderation notes

- Public visitors can only read reports where `moderation_status = 'approved'`.
- Anonymous visitors can submit new reports.
- Updates and deletes are blocked for anonymous visitors.
- If you later want manual review, you can change inserted rows to default to `pending` and create a simple admin workflow separately.

## Singapore scientific references

- Griffiths J, Yeo HL, Yap G, et al. *Survey of rodent-borne pathogens in Singapore reveals the circulation of Leptospira spp., Seoul hantavirus, and Rickettsia typhi*. Scientific Reports. 2022. PubMed: https://pubmed.ncbi.nlm.nih.gov/35177639/ Free full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC8854382/
- Chan OY, Chia SE, Nadarajah N, Sng EH. *Leptospirosis risk in public cleansing and sewer workers*. Ann Acad Med Singap. 1987. PubMed: https://pubmed.ncbi.nlm.nih.gov/3446001/
- Foo CCY, Leow EHM, Phua KB, Chong CY, Tan NWH. *A Case of Kawasaki Disease With Concomitant Leptospirosis*. Global Pediatric Health. 2017. PubMed: https://pubmed.ncbi.nlm.nih.gov/28804750/ Free full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC5533253/
- Kwak ML, Ng A, Nakao R. *Nation-wide surveillance of ticks (Acari: Ixodidae) on dogs and cats in Singapore*. Acta Tropica. 2025. PubMed: https://pubmed.ncbi.nlm.nih.gov/39864721/
- Hartantyo SHP, Chau ML, Fillon L, et al. *Sick pets as potential reservoirs of antibiotic-resistant bacteria in Singapore*. Antimicrob Resist Infect Control. 2018. PubMed: https://pubmed.ncbi.nlm.nih.gov/30186596/ Free full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC6117887/
