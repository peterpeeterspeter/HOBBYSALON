# Article sidecar in de matchingpipeline

De artikelmatchingworker, de creator-dashboardactie en de alleen-lezen catalogus-dry-run gebruiken dezelfde planner uit `article-sidecar-matching.ts`. De planner leest de private bucket `article-metadata-sidecar`, prefix `v1-2026-10-26`, en controleert de vaste manifest-SHA256 voordat de metadata wordt gebruikt. Er zijn geen nieuwe databasetabellen of migraties nodig.

## Verwerking

1. De worker haalt het volledige, gepinde bronpakket op voordat hij een job claimt. Het dashboard cachet alleen dit onveranderlijke pakket; een mislukte download kan opnieuw worden geprobeerd.
2. Voor ieder artikel wordt de bestaande SQL-fingerprint vastgelegd en daarna de opgeslagen tekst gelezen. De sidecar-SHA256 wordt berekend over exact die tekst, zonder normalisatie. Publicatiestatus wordt eveneens opnieuw gelezen.
3. Ontbrekende, gewijzigde, ongepubliceerde, geblokkeerde of onvolledige records leveren geen voorstellen op. Er is geen terugval op de oude tekstmatcher wanneer een sidecarcontrole faalt.
4. Alleen expliciete required/optional materialen en tools binnen een eenduidige projectcontext mogen productkandidaten onderbouwen. Voorbeeldmaterialen, alternatieven, ongeverifieerde projectlabels en materiaalverzamelingen uit overzichten worden niet samengevoegd.
5. Producten worden tevens gecontroleerd tegen de gepinde cataloguskwalificatie en de actuele titel, beschrijving, productsoort en domein. Test-/onopgeloste of gewijzigde profielen blijven buiten de selectie. Onvolledige kits blijven handmatig zoekwerk; restgaren vereist een expliciete restgarenbehoefte. Een beschrijving als ‘verf voor papier’ maakt verf niet tot een papierproduct.
6. Alle bestaande links in beide richtingen en alle reviewparen worden uit nieuwe voorstellen gehouden, ook een accepted/dismissed beslissing waarvan de link al is verwijderd.
7. Alleen de bestaande atomische `graph_propose_article_suggestions`-RPC mag nieuwe pending reviews/suggested_auto-links opslaan. De SQL-fingerprint blijft de transactiebewaking; hij is niet de SHA256 uit de sidecar. Er wordt niets automatisch goedgekeurd en bestaande beslissingen worden niet bijgewerkt.

Productvoorstellen blijven `related_product` met `compatibility=unknown`. Het bewijs bevat de datasetversie, artikelhash, rollen, specificaties, projectlabels, exacte citaten en eventuele catalogusbeperkingen. Artikelbeweringen zijn geen extern gecontroleerde compatibiliteit, veiligheid, voorraad of koopbaarheid. Concept-ID's en artikel-artikelrelaties worden niet in het product/workshop/event-RPC-contract geduwd.

De worker rapporteert `sidecarState` per artikeljob. Een verwerkt maar geblokkeerd artikel heeft nul voorstellen; de job kan als voltooid worden vrijgegeven. Een volgende artikelwijziging wordt via de bestaande triggers opnieuw aangeboden. Ontbrekende of gewijzigde extracties vereisen een nieuwe sidecarrelease.

## Uitvoeren

Node 22.13+ en de bestaande Supabase-URL/service-roleconfiguratie zijn vereist. De bucket blijft privé. De CLI maakt geen nieuwe sleutel of toegangspolicy aan.

```sh
# Alleen lezen: huidige tekst + volledige toegelaten catalogus + reviewgeheugen.
yarn workspace storefront auto-link:articles --limit 20 --env-file /absoluut/pad/worker.env

# Schrijft pending voorstellen en claim-/release-statussen; nooit automatische goedkeuring.
yarn workspace storefront match:articles --max-jobs 1 --max-catalog-batches 1 --env-file /absoluut/pad/worker.env

# Offline controle van een gedownload pakket en een volledige hash-snapshot.
yarn workspace storefront check:article-sidecar --bundle-dir /absoluut/pad/pakket --article-hashes /absoluut/pad/snapshot.json
```

Een expliciet worker-envbestand staat los van omgevingsvariabelen uit een ander project. Bij een mislukte Storage-download of verkeerde manifestpin claimt de CLI geen jobs. De code voegt geen daemon, cron of automatische publicatie toe.

## Nieuwe release

Publiceer een nieuw, afzonderlijk prefix met manifest en gecontroleerde bronbestanden. Werk daarna `ARTICLE_SIDECAR_RELEASE` met het nieuwe prefix en de onafhankelijk gecontroleerde manifesthash bij. Verander het bestaande gepinde pakket niet in-place. Een vernieuwde release vereist opnieuw een hash-/schema-/broncontrole en een dry-run tegen de actuele catalogus en reviewbeslissingen.

## Verificatie

De CI bevat de sidecar-loader- en workerintegratietests. De bestaande graph-tests controleren daarnaast de creator-saveactie, CLI-HTTP-protocollen, reviewgeheugen, lease/fingerprint-races en uitsluiting van pending links op publieke pagina's.

De lokale integratiecontrole op 26 oktober 2026 gebruikte 73 actuele artikelen zonder extractiehiaten en 154 actuele toegelaten catalogusentiteiten. De planner leverde 72 workshop-/eventvoorstellen, geen productvoorstellen. Dit was een alleen-lezen dry-run; het bewijst geen productie-uitrol of daadwerkelijk opgeslagen voorstellen.
