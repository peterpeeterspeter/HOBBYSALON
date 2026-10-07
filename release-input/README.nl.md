# Exacte scoped kandidaat — vierde normale build

Eigenaar keurde de native reconciliation-auditmigratie, één extra normale hosted build (vierde totaal; cumulatief maximaal vier) en geïsoleerde DB/runtimegates expliciet goed. Deze fase bereidt uitsluitend de publicatie-input voor: geen commit, push, build, installatie of applicatiestart. Geen vijfde build, rerun, provideractie, merge, deploy, registry push of live-acceptatie.

Enige bronaddition in deze refresh: `packages/modules/b2c-core/src/modules/marketplace/migrations/Migration20261007070000.ts` (`100644`), SHA-256 `fa7a70a4fd15c56607cf44275d3382f17fcd42baeaebbc0e18e0eaf433b6d4e7`. Alle 1331 bestaande archiefleden, root `.dockerignore`, dependencylocks en Dockerrecipe blijven byte- en mode-identiek. Private regressietests en scripts buiten de bestaande allowlist zijn niet toegevoegd.

Archive SHA-256: `47ce7aaf7045bc7006e896845bae013b9368f04520b10b20ba05edbc1174b1c1`
Manifest SHA-256: `d9ec2c9fbc51d77808b72a0ddd24694c437f072126fcb7919487a5a40703de02`
Bestanden: 1332. Bronbytes: 3532368. Archiefbytes: 555748.

Signature en exactsourceverifier zijn verplicht vóór de normale Dockerbuild. De bestaande scoped opsbranch, pushpaths en run_attempt=1 blijven behouden. Geen source overlay, private resolver of uitgeschakelde backendtypecontrole. Historische rapporten zijn bewaard; private backups en nieuwe verificatiereceipts staan buiten de publicatie.

De bestaande openbare demo-seed blijft hash-identiek; dit is geen productiecredentialacceptatie. Een begrensde tokenscan van uitsluitend de nieuwe migratie geeft geen treffers en toont geen waarden. Tests worden in een volgende fase afzonderlijk aan de werkelijk geslaagde nieuwe build gebonden. Build-GREEN is geen runtime-, provider- of productie-GO. Onafhankelijke parentreview volgt vóór iedere commit/push/build.
