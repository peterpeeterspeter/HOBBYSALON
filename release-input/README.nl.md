# Exacte SDK-initkandidaat — vijfde normale build

Deze fase A vernieuwt alleen de acht publicatie-inputs na de gereviewde bronfix. Maximaal vijf builds cumulatief, inclusief precies één extra vijfde build; geen zesde of rerun. Geen staging, commit, push, build, vierde-image-regating, fase B-publicatie, container-/applicatiestart of productie-GO. Onafhankelijke parentreview en afzonderlijk geautoriseerde bronpublicatiecommit zijn verplicht vóór de vijfde build.

Enige actuele manifestdelta: gewijzigde `apps/backend/src/modules/index-runtime-readonly/index.ts`; toegevoegd `scripts/tests/index-runtime-sdk-init.test.cjs`. De overige 1331 bestaande leden zijn byte-, mode- en manifestregel-identiek. Root .dockerignore, locks, Dockerfile, entrypoint, preflight en buildrecipe zijn ongewijzigd.

De SDK-test is een expliciet goedgekeurd aanvullend archieflid buiten de oorspronkelijke zeven bronroots. De bestaande exclusionspartition geldt ongewijzigd voor die oorspronkelijke roots; er worden geen overige scripts toegevoegd. De ongewijzigde Dockerrecipe COPYt scripts niet en voert deze test niet automatisch uit. De index.ts-fix staat wel onder apps/backend/src en wordt door de standaard medusa build automatisch gecompileerd met typecontrole; geen overlays/private resolver. Verwachte index.js bevat de zes interne serviceimports; werkelijke nieuwe imagebytes zijn nog niet gebouwd of geïnspecteerd.

Archive SHA-256: `c439c536c4caf9b70d0e551f350e525b88d05749b6eb0325bc8c8d3e5846476e`
Manifest SHA-256: `4b4b4fa7fd5e81f9954c9aeb61595802d4f8847730ac3ff07e0b9151fad62fd6`
Bestanden: 1333; bronbytes: 3546856; archiefbytes: 559340.

Signature/exactsourceverifier blijven verplicht. Scoped opsbranch, pushpaths, run_attempt=1, netwerkgeblokkeerde standaardbackendbuild en imageinspectie zijn behouden. max_builds is een autorisatieplafond, geen nieuwe automatische servercounter. Huidige bd652c7 gate/harnessbytes blijven behouden. Offline preflight/sourceverificatie is geen image-, PostgreSQL-, runtime-, provider-, release- of productieacceptatie. Privébewijs staat in sdk-init-fix/phaseA; historische audit-native-fix/build-inputs blijft ongewijzigd.
