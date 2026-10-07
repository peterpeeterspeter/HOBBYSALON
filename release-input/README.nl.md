# Exacte kandidaat — uitsluitend hosted build

Eigenaar autoriseert publieke scoped code op `ops/release-validation-20261007` en één hosted build; deze voorbereiding pusht NIET. Geen merge, PR, deploy, registrypush, database/provider/serverstart of runtimeacceptatie.

Bronbasis `bb33a1c1a41e3ac47973badf9283d1330eb9525e` plus exacte huidige werkboombytes (ook nieuwe bestanden). Archive: `596ef6d7a70f316b92b8dcc59b9e139b5b006867375de48f3998def810daf3f2`. Manifest: `72634b09f6c17ab57cde6004df3df3fe0e3ef62fbd15a862272ce637d0a3aa13`. Scope: .dockerignore, package.json, yarn.lock, turbo.json, packages, apps/backend, deploy/release. Root .dockerignore is byte-identiek opgenomen als contextbesturing, niet als COPY-root. Alle 1331 bestanden: 3526021 bytes. Exacte uitsluitingen staan in source-exclusions.json; geen extra git-ignorefilter. Dockerfile en recept zijn byte-identiek gekopieerd; geen productwijziging.

Het seedscript bevat een bestaande publieke demo-passwordliteral: SHA-256 `59fd895f41a505df5e7bd361170264f8133bdfb7f6015541170325dcb445968e`, lokaal byte-identiek aan HEAD/bronbasis. Dit blijft een credential, geen niet-credential of generieke secret-uitzondering. Onafhankelijke verificatie van de remote publieke bytes gebeurt afzonderlijk vóór publicatie; dit is geen productiecredentialacceptatie. Geen credentialwaarden gepubliceerd in reviewoutputs.

Bronattestatie is lokaal Ed25519-ondertekend, uitsluitend technische hashes; dit is geen cryptografische eigenaarsidentiteitsclaim. Publieke sleutel en signature meegeleverd; privésleutel uitsluitend buiten publicatietree.

Verificatie vooraf: verify-source.py controleert alle archivebytes, manifest, paden, modes, aantallen en goedkeuring. Hosted normale buildx --load compileert met exact Dockerfile, compileernetwerk uit. Buildmetadata en image inspect worden zonder env geprojecteerd. Bestaande dependencyvrije inspector start geen applicatie. Daarna docker save op immutable image-ID, artifact release-candidate-20261007, zeven dagen. Mislukte inspectie/build is geen acceptatie. Geen lokale install/build/containeractie uitgevoerd.

Nieuwe orphan tree bevat alleen workflow, inputs/verifiers en drie Vercel deploymentEnabled:false-configs. Enkel eerste branchcreatie/run_attempt=1; geen dispatch/rerun. Geen platformbreed once-token: branch niet recreëren. Externe deployintegraties buiten Vercel moeten vóór eventuele publicatie onafhankelijk geblokkeerd worden.
