# Financiële reconciliatiecandidate — NIET VRIJGEGEVEN

Dit is broncode voor begrensde Stripe-testreconciliatie en geïsoleerde hersteltests. Publicatie van deze branch is geen toestemming voor productie, provider-writes, migraties of operationeel financieel herstel.

## Onderdelen

- `ledger`: schema-first native inventarisatie in een allowlisted sandbox, met `REPEATABLE READ READ ONLY` en afsluitende `ROLLBACK`.
- `check`: gepagineerde Stripe GET-reads met verplichte accountpin en onafhankelijk bevestigde restricted-keyrechten. De CLI weigert gewone secret keys. Financiële objectidentiteit, bruto-effecten en exacte bedragen worden afzonderlijk vergeleken.
- `raw_snapshot.py`: verliesloze acquisitie en validatie voor repair-evidence; een genormaliseerd ledger-overzicht vervangt geen raw snapshot.
- `native_repair.py`: fail-closed bibliotheek voor herstelplanning en geïsoleerde SQL-acceptatie. De publieke CLI heeft geen operationele apply-opdracht.
- `no_effect_candidate.py`: begrensde kandidaat voor uitsluitend aantoonbare no-effectgevallen; afwezig providerbewijs is nooit voldoende.
- `isolation_check.py`: vaste read-only inspectie zonder uitvoeringsbevoegdheid. Ontbrekende isolatie-, writer- of routingattestatie blokkeert acceptatie.

## Vertrouwensgrenzen

Geen blind replay, statusreset, fictieve refund of achteraf verzonnen historisch bewijs. Quarantaines en financiële verplichtingen blijven behouden totdat een onafhankelijk geaccepteerd protocol werkelijk is uitgevoerd. Captureboekhouding, enqueue en duurzame consumer-ACK zijn afzonderlijke voorwaarden.

Stripe-reads vormen geen atomair checkpoint. Voor operationele acceptatie zijn externe writerfences, stabiele readbacks, onafhankelijke bewijsbinding en afzonderlijke bevoegdheid nodig. Scheduler en alertlevering zijn niet door branchpublicatie geactiveerd.

## Privéconfiguratie en evidence

Bewaar credentials en runtime-/accountbindings buiten Git en Dockercontext. Eigenaar-only bestanden, geen symlinks. Verleen uitsluitend noodzakelijke leesrechten in het bedoelde Stripe-testaccount; test rechten nooit met provider-writes.

Raw uitvoer, concrete financiële inventarissen en historische auditrapporten blijven privé. Ze zijn geen openbare documentatie. Historische testresultaten bewijzen uitsluitend de destijds geteste bytes en scope.

## Tests

Offline regressies vanuit de repositoryroot:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s scripts/tests -p 'test_reconciliation*.py' -v
```

PostgreSQL-integratietests vereisen expliciete opt-ins en de bestaande gecontroleerde sandboxharness. Zonder opt-ins kunnen tests worden overgeslagen; meld skips eerlijk. Financiële fixturewrites zijn uitsluitend toegestaan in verse disposable testdatabases, nooit in operationele herstelgevallen.

## Resterende vrijgavevoorwaarden

Onafhankelijke actuele bron-/schema-/engineacceptatie, echte runtime-isolatie, providerrechten/accountbinding, bevoegde repair-commit/readback, Redis/event-ACK, volledige reconciliatie zonder echte verschillen, bewezen alerts en een afzonderlijk goedgekeurde uitrol. Tot die keten aantoonbaar slaagt blijft de status **NO-GO**.
