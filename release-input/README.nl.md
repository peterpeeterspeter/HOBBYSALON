# Exacte scoped kandidaat — derde normale build

Eigenaar gaf expliciet toestemming voor één extra build, cumulatief maximaal drie. Alleen de native indexverificatiebron is gewijzigd; private regressietests zijn niet in het sourcearchive opgenomen. Geen vierde build, rerun, merge, deploy, registry push of provideractie toegestaan.

Archive SHA-256: `c2b0bbf79487566e8e8288f10a18c66d6da780055f0917955d3344b599f476b9`
Manifest SHA-256: `ca20704e73de126ecffd1c02956e4252141388a6d6d9cc54057036425800865e`
Bestanden: 1331. Bronbytes: 3529172.

Bron, dependencylock, Dockerfile en root .dockerignore zijn exact gebonden. Signature en source verifier verplicht vóór normale Dockerbuild. Build op bestaande scoped opsbranch via beperkte push paths; run_attempt=1. Geen private resolver, source overlay of uitgeschakelde backendtypecontrole.

Publicatie bevat alleen scoped source en technische attestatie, geen private logs of keys. Eerder openbare demo-seed is hash-identiek; dit is geen productiecredentialacceptatie. Tests worden pas afzonderlijk gebonden aan de werkelijk geslaagde nieuwe build; build-GREEN is geen runtime-, provider- of productie-GO.
