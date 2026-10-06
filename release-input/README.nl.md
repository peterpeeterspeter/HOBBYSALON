# Eenmalige frozen ACK-backendbuild — alleen build

Publieke draft voor `peterpeeterspeter/HOBBYSALON`, uitsluitend branch
`ops/backend-ack-build-20261006`. De eigenaar heeft alleen inputpublicatie en
één GitHub-hosted build toegestaan. Dit is geen productie-, migratie-, provider-,
server-, deployment- of runtime-acceptatie. Geen PR, main-merge, dispatch,
registrypublicatie of herstart/heruitvoering toegestaan. Kosten zijn onbekend.

## Publicatietree en toestemming

Parent-commit: `93fc39ef94a20584922b22ca385e8d5648c9e103`; tree is **minimaal**,
niet de volledige main-tree. Uitsluitend deze draftbestanden en twee bestaande
inputblobs opnemen. De parent-agent verricht onafhankelijke review en één push;
deze draft voert geen Git-/netwerk-/buildacties uit. Geen privé-audits, raw lokale
rapporten, financiële cijfers of voorspelde Docker-COPY-receipts publiceren.

De bestaande blobs worden zonder lokale duplicatie gekoppeld aan:
- `release-input/source.full.tar.xz`: SHA-256
  `36a2741385a4da96e6e26edce50422ca05d9e3267a1e3f1f5face63cd3e447b6`.
- `release-input/source.full.manifest.jsonl`: SHA-256
  `c4cc4183fa6ec3f4e787501dc476fe84297ac5bf0974569075498f3a32610bb1`.

`approval.json` bindt base, archive, manifest en exact vijf geaccepteerde
patchbestanden. Het patchbestand zelf hoeft niet publiek te worden toegevoegd.
Alle werkelijke applicatiebron staat binnen het archive, niet los in deze tree.

## Worker en grenzen

Pushtrigger op uitsluitend de exacte branch, alleen branchcreatie en
`run_attempt == 1`; geen dispatch/PR-trigger. Dit is geen duurzaam platformbreed
once-token: branch niet verwijderen/hermaken en workflow niet wijzigen of opnieuw
uitvoeren. Concurrency annuleert niets. Eén job, maximaal 40 minuten; artifact
retentie zeven dagen. Upload wordt ook op falen geprobeerd, maar timeout of
annulering kan artifactopslag verhinderen. Mislukte of ontbrekende receipts zijn
geen acceptatie.

Pinned checkout, buildx en artifactacties; contents read, geen checkoutcredentials,
geen secrets, submodules, registrylogin of push. De worker mag voor de goedgekeurde
build baseimage/registrydependencies ophalen. De exacte archive-Dockerfile blijft
ongewijzigd: compileerstap `--network=none`, geen DB/server/providerstart.

Bronverificatie controleert eerst alle bytes/paden/types/modes/counts onder 100MB,
en schrijft daarna uitsluitend een nieuwe private workercontext met behouden
0644/0755-modes. Geen `.dockerignore`-COPY-prediction wordt gebruikt.

De echte image wordt op immutable image-ID gecontroleerd: `/release` en entrypoint
via een nooit gestarte container; dependency-free Node-inspector via aparte
network-none/read-only container, UID 1001, 256MB, 1 CPU, 128 PIDs, geen capabilities,
geen healthcheck/appimports. Receipts bevatten actual baked-source hashes en alle
bestanden onder backendcompiled, alle modulecompiled, frameworkdist en releasehelpers,
plus native ACK-migratie en capturecontract. Installed-manifestpariteit is geen
volledige dependency-byteprovenance en geen functionele runtimevalidatie.

Het goedgekeurde image wordt alleen na geslaagde inspectie lokaal als gzip-artifact
opgeslagen. Labels binden de bronbase en inputhashes, niet de opsbranchcommit.
Een receipt-PASS betekent build-only inspectie; productie/runtime blijft false.

## Deploymentblokkering

Root, storefront en vendor-panel hebben `git.deploymentEnabled: false`.
Configuratiereferentie: https://vercel.com/docs/project-configuration/git-configuration
Dit onderdrukt de Vercel Git-integratie voor deze tree; het is geen universele
blokkade voor andere externe integraties. Parent controleert vóór publicatie
onafhankelijk dat geen andere gekoppelde service de opsbranch automatisch deployt.

## Lokale verificatie zonder extractie

Gebruik `python3 release-input/verify-source.py` met expliciete `--archive`,
`--manifest`, `--approval`, `--dest` en `--verify-only`. `--dest` moet een afwezige
child in een lokaal owned, niet-symlinked, private tijdelijke directory zijn.
Er wordt dan niets geëxtraheerd. Werkelijke imagechecks zijn alleen voor de
later geautoriseerde hosted build en zijn lokaal niet uitgevoerd.
