# Exacte zesde kandidaat — lokale PhaseA24

Owner separately authorized: one extra sixth candidate build (cumulative maximum six) and one isolated verification run; no seventh build, automatic retry, rerun, merge, deploy, provider/DB privilege change or rollback image change. This PhaseA24 performs source-input preparation only: no build, verification workflow run, staging, commit, push, container/application launch, provider or DB action. Independent parent review and authorized necessary source/workflow publication must precede execution. Offline source/recipe PASS is not image/runtime/release GO.

Enige bronwijziging: `apps/backend/entrypoint.sh`; toevoegingen: `deploy/release/startup-pg-errors.cjs`, `deploy/release/verify-startup-pg-errors.cjs`. Overige 1332 oorspronkelijke members, gitmodes en manifestregels identiek. Dockerfile, locks, recipe, businesslogica, rollback en alle release-tests/runtimegates ongewijzigd. Helpers worden via bestaande Docker COPY en runtime CJS-archive meegenomen; regressiontest wordt niet automatisch in de build uitgevoerd.

Acht bindinginputs plus noodzakelijke negende `release-input/inspect-compiled.cjs`: uitsluitend beide nieuwe helperpaden toegevoegd aan required list. Bestaande walker vergelijkt aanwezige CJS-hashes, maar wees afwezigheid niet af; nieuwe required guards voorkomen dat ontbrekende helper/test toch PASS geeft. Alle bestaande inspectorchecks behouden. Werkelijke imagehelper-/dependencyhashes moeten later uit baked/compiled receipts worden geverifieerd; nu niet gebouwd.

Archief SHA256: `3cd277fcebd6af36bfa9fd964d29ac601932ecc4cf932caca34d080d172e46a3`
Manifest SHA256: `08cd70c1806adc4b6e81ea89ce4b64ab5dad2303f4fd640279041acf62895f8e`
Bronbestanden: 1335; bronbytes: 3572055. Maximaal zes cumulatief: één extra build en één echte geïsoleerde verificatierun; geen zevende/rerun/deploy. Het plafond is een autorisatiebinding, geen nieuwe automatische servercounter.

Nieuwe autorisatie- en onafhankelijke sourcereviewhash zijn in approval/attestation/verifier gebonden. Geen release-tests aangepast of uitgevoerd. PhaseA24 vereist onafhankelijke parentreview vóór publicatie/build; source/offline PASS is geen image-, DB-, runtime-, release- of productie-GO.
