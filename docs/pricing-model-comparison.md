# Prijsmodel: creditsysteem per plaatsing vs. jaarabonnement

Vergelijking van het voorgestelde **pay-per-listing creditmodel** met het **abonnementsmodel zonder commissie** dat vandaag in de repo staat.

Voorgestelde prijzen (creditmodel):

| Plaatsing | Prijs |
|---|---|
| Advertentie hobbyist (afgewerkt stuk, hobbymaterialen) | €0,50 |
| Event | €5 |
| Hobbybeurs | €20 |
| Workshop | €15 |
| Materialenverkopers | 10% commissie (ongewijzigd) |

---

## 1. Wat er al gebouwd is

De eerdere berekening zit verspreid over code en docs. Samengevat:

**Abonnementen** — `apps/storefront/scripts/seed-commercial-plans.sql`

| Code | Prijs | Periode | Limiet |
|---|---|---|---|
| `workshop_essential` | €190 | jaar | 5 actieve workshops |
| `workshop_premium` | €690 | jaar | onbeperkt |
| `maker_free` | €0 | jaar | — |
| `maker_premium` | €99 | jaar | 50 producten |
| `supplier_basic` | €0 | jaar | — |
| `supplier_premium` | €490 | jaar | — |
| `organizer_event_basic` | €49 | per event | — |
| `organizer_event_premium` | €249 | per event | — |

**Creditsysteem (makers)** — bestaat al: `apps/storefront/scripts/migrate-listing-credits.sql` + `src/lib/platform/listing-credits.ts`

| Pack | Credits | Prijs | Prijs/credit |
|---|---|---|---|
| Starter | 10 | €9 | €0,90 |
| Maker | 25 | €19 | €0,76 |
| Growth | 60 | €39 | €0,65 |
| Pro | 150 | €79 | €0,53 |
| Market Pack | 350 | €149 | €0,43 |

Verbruik (`LISTING_CREDIT_COSTS`): listing 1, bump 1, collectiepagina 3, spotlight 7 dagen 5, homepage spotlight 20, nieuwsbrief 35.

**Commissie** — `docs/billing-commission-matrix.md`: supply 10%, handmade 6%, workshop_kit 10% (6% voor creator-sellers). `event_listing`, `event_ticket` en `workshop_ticket` staan er expliciet als *flat fee, TBD, placeholder €1 tot business de waarden bepaalt*.

> **Belangrijkste vondst:** het voorstel is geen breuk met het verleden. €0,50 per advertentie ligt precies op de bestaande creditprijs (€0,43–€0,90 per credit), en €5/€15/€20 vullen exact de drie `TBD`-velden in de commissiematrix. De infrastructuur — wallet, transactielog, packs, RLS — is er al.

---

## 2. Transactiekosten: waarom €0,50 nooit los verkocht mag worden

Bij ~€0,30 vast + 1,8% (Mollie/Stripe EU):

| Bedrag | Kosten | Netto | Kosten als % |
|---|---|---|---|
| €0,50 | €0,31 | €0,19 | **62%** |
| €5 | €0,39 | €4,61 | 7,8% |
| €15 | €0,57 | €14,43 | 3,8% |
| €20 | €0,66 | €19,34 | 3,3% |
| €9 creditpack | €0,46 | €8,54 | 5,1% |
| €190 abonnement | €3,72 | €186,28 | 2,0% |

Een losse afrekening van €0,50 verliest 62% aan de betaalprovider. Via een creditpack van €9 zakt dat naar 5%. De conclusie is dwingend: **€0,50 mag alleen bestaan als 1 credit uit een vooraf gekocht pack** — precies zoals het systeem nu al werkt. Nooit als losse transactie.

---

## 3. Break-even: hoeveel plaatsingen evenaren één abonnement

| Plaatsing | Prijs | Evenaart | Aantal nodig |
|---|---|---|---|
| Workshop | €15 | Essential €190 | 12,7 |
| Workshop | €15 | Tracked €390 | 26,0 |
| Workshop | €15 | Premium €690 | 46,0 |
| Event | €5 | Event Basis €49 | 9,8 |
| Beurs | €20 | Event Basis €49 | 2,5 |
| Beurs | €20 | Event Premium €249 | 12,5 |
| Advertentie | €0,50 | Maker Premium €99 | **198** |
| Advertentie | €0,50 | Winkel Premium €490 | **980** |

---

## 4. Opbrengst per persona

| Persona | Volume/jaar | Creditmodel | Huidig abomodel | Verschil |
|---|---|---|---|---|
| Workshopgever, klein | 4 workshops | €60 | €190 | **−68%** |
| Workshopgever, actief | 12 workshops | €180 | €190–390 | −5% tot −54% |
| Workshopgever, groot | 40 workshops | €600 | €690 | −13% |
| Organisator, 1 beurs | 1 beurs | €20 | €49–249 | **−59% tot −92%** |
| Organisator, eventreeks | 8 events | €40 | €392 | **−90%** |
| Hobbyist / maker | 24 advertenties | €12 | €0 (`maker_free`) | +€12 |
| Materialenwinkel | — | 10% | 10% | 0% |

Het patroon: hoe actiever de aanbieder, hoe dichter de modellen bij elkaar liggen. Bij lage frequentie — en dat is de meerderheid — levert het creditmodel 60–90% minder op per account. Maar het abomodel int dat alleen bij wie effectief converteert.

---

## 5. Scenario jaar 1

Aannames: 120 workshopgevers, 15 beurzen, 60 kleinere events, 800 adverterende hobbyisten, 60 materialenwinkels, GMV materialen €300k.

**Creditmodel** (conversie ~90%, drempel is laag)

| Bron | Berekening | Omzet |
|---|---|---|
| Workshops | 108 × 8 × €15 | €12.960 |
| Beurzen | 15 × €20 | €300 |
| Events | 60 × €5 | €300 |
| Advertenties | 800 × 8 × €0,50 | €3.200 |
| **Subtotaal plaatsingen** | | **€16.760** |
| Commissie materialen | 10% van €300k | €30.000 |
| **Totaal** | | **€46.760** |

**Abonnementsmodel** (realistische conversie 35–50%)

| Bron | Berekening | Omzet |
|---|---|---|
| Workshopgevers | 32×€190 + 8×€390 + 2×€690 | €10.580 |
| Organisatoren | 8×€249 + 30×€49 | €3.462 |
| Makers | 15 × €99 | €1.485 |
| Winkels premium | 10 × €490 | €4.900 |
| **Subtotaal abonnementen** | | **€20.427** |
| Commissie materialen | 10% van €300k | €30.000 |
| **Totaal** | | **€50.427** |

De modellen landen binnen ~8% van elkaar. Het verschil zit niet in de omzet maar in het **risico**:

- Het abomodel haalt €20k uit ~75 betalende accounts. Zakt de conversie van 40% naar 20%, dan verdampt de helft. Elke euro vraagt een verkoopgesprek over verkeer dat nog niet bewezen is.
- Het creditmodel haalt €16,7k uit ~1.000 accounts met vrijwel geen verkoopinspanning. Halveert het volume, dan verlies je €8k — pijnlijk maar niet fataal.

Bij een platform dat zijn publiek nog moet bewijzen is dat tweede risicoprofiel veruit het gezondere.

---

## 6. Waar de voorgestelde prijzen scheef zitten

**De beurs van €20 is de grootste misprijzing.** Een hobbybeurs-organisator rekent standhouders €150–400 per stand aan, en volgens de PRD geeft 47% van de bezoekers €50–150 uit per beursbezoek. Bereik naar een lijst van 44.000 hobbyisten voor €20 is één à twee procent van de waarde die je levert. Ook intern klopt de ladder niet: een beurs kost 4× een workshop van €15, terwijl de commerciële waarde eerder een factor 10–20 verschilt. **Advies: €99 basis, €249 met promotie** — dat is nog altijd fors onder `organizer_event_premium` en makkelijk te verkopen.

**Het event van €5 is te laag maar minder erg**, omdat kleine events vooral aanbodvulling zijn. €15 is verdedigbaar; €5 als introductie kan, mits je het als tijdelijke lanceerprijs kadert.

**Bij de workshop van €15 moet je de eenheid definiëren.** Is één plaatsing een evergreen listing met onbeperkt data, dan is €15 te goedkoop en kannibaliseert het Essential meteen. Is het per datum, dan betaalt een docent met 20 sessies €300 — méér dan Essential — en krijg je klachten. **Advies: €15 per workshoplisting, geldig 90 dagen, max 3 tegelijk actief, zonder ranking of uitgelichte rotatie.**

**Kannibalisatie is het echte gevaar.** Als een €15-plaatsing dezelfde zichtbaarheid geeft als Essential, koopt niemand meer €190. De plaatsing moet zichtbaar minder zijn: geen hogere ranking, geen uitgelichte rotatie, geen video, geen profielpagina met alle workshops. Het goede nieuws: `visibility_boosts` en `src/lib/platform/ranking.ts` maken dat vandaag al afdwingbaar.

**€0,50 maakt spam goedkoop.** De rolgoedkeuring die er is (commit `51a3a09`) dekt professionals af; voor hobbyistadvertenties heb je automatische moderatie plus een limiet per account per maand nodig.

---

## 7. Advies: hybride, met credits als oprit

Niet kiezen tussen de twee — ze bedienen verschillende momenten in de levenscyclus van een aanbieder.

| Segment | Model |
|---|---|
| Hobbyist C2C (afgewerkt stuk, materialen) | Alleen credits. 1 credit = €0,50. Nieuw segment, zit vandaag in geen enkel plan. |
| Makers | Credits (bestaand) + 6% commissie. Ongewijzigd. |
| Workshopgevers | €15/plaatsing (max 3 actief, 90 dagen, basiszichtbaarheid) **óf** Essential €190. |
| Organisatoren | €15/klein event, €99/beurs basis, €249/beurs met promotie. |
| Materialenwinkels | 10% commissie. Ongewijzigd. |

De sleutel is de **upgradebrug**: credits die iemand binnen een jaar uitgeeft, tellen mee bij het overstappen naar een jaarplan. Dat haalt de of-of-keuze weg, en rond €150 uitgegeven credits ontstaat vanzelf het gesprek — "je hebt €165 aan losse plaatsingen betaald, Essential kost €190 en geeft je ranking erbij". Dat is een verkoopgesprek met bewijs in plaats van een belofte.

Prijsladder in één munt, zodat alles door dezelfde wallet loopt:

| Plaatsing | Credits | Effectief |
|---|---|---|
| Hobbyistadvertentie | 1 | €0,50 |
| Handmade productlisting | 1 | €0,50 |
| Bump | 1 | €0,50 |
| Collectiepagina | 3 | €1,50 |
| Spotlight 7 dagen | 5 | €2,50 |
| Klein event | 30 | €15 |
| Workshop | 30 | €15 |
| Homepage spotlight | 40 | €20 |
| Nieuwsbrieffeature | 70 | €35 |
| Hobbybeurs basis | 200 | €99 |
| Hobbybeurs promotie | 500 | €249 |

Om 1 credit ≈ €0,50 te laten kloppen moeten de packs licht bijgesteld: nu loopt de prijs per credit van €0,90 naar €0,43. Zet de middelste packs op ongeveer €0,50 en gebruik alleen de grootste packs voor volumekorting.

**Wat dit doet met de positionering.** De belofte tegenover Spot Workshops wordt sterker, niet zwakker. Nu is het "vaste jaarprijs, geen commissie" — nog altijd €190 vooraf voor onbewezen verkeer. Met credits wordt het: *geen commissie op je deelnemers én geen abonnement — je betaalt per plaatsing, vanaf €15.* Dat is een makkelijker eerste ja, en Spot kan het niet kopiëren zonder hun eigen model te ondergraven.

---

## 8. Technische aandachtspunten

Als dit doorgaat, moeten deze punten in de bestaande implementatie mee:

1. **Wallet is creator-gebonden.** `listing_credit_wallets.creator_id` verwijst naar `creators(id)`. Hobbyisten zijn geen creators. Nodig: een user-scoped wallet, of automatisch een lichtgewicht creator-record bij de eerste advertentie.
2. **Race condition in de wallet.** `addCredits` en `consumeCredits` in `src/lib/platform/listing-credits.ts` lezen het saldo en schrijven het daarna terug, zonder lock of atomaire operatie. Bij twee gelijktijdige plaatsingen kan saldo verdwijnen of dubbel besteed worden. Dit moet een Postgres-RPC met `update ... set balance = balance - $1 where balance >= $1 returning balance` worden voordat het volume oploopt.
3. **Transactie-redenen zijn te beperkt.** De check-constraint laat alleen `purchase`, `listing_create`, `listing_bump`, `spotlight`, `refund`, `manual_adjustment` toe. Er moeten redenen bij voor workshop-, event- en beursplaatsingen.
4. **Vervaldatum ontbreekt.** Er is geen concept van een aflopende plaatsing. Voor "€15, 90 dagen geldig" is een `expires_at` op de listing plus een opruimjob nodig.
5. **Prijzen in de repo lopen uiteen met de publieke pagina's.** `voor-workshopgevers` toont een tier "Tracked" van €390 die niet in `seed-commercial-plans.sql` staat, en `voor-winkels` toont €29/maand (€348/jaar) terwijl de seed `supplier_premium` op €490/jaar zet. Dit moet hoe dan ook gelijkgetrokken worden.
6. **Commissiematrix afwerken.** `event_listing`, `event_ticket` en `workshop_ticket` staan nog op placeholder €1 in `apps/backend/src/scripts/seed/seed-functions.ts`.

---

## 9. Samenvatting

- Het creditmodel en het abomodel leveren in jaar 1 ongeveer evenveel op (€46,8k vs €50,4k), maar het creditmodel spreidt dat over vijf keer zoveel accounts en heeft geen verkoopteam nodig.
- €0,50 werkt uitsluitend als vooraf gekochte credit; los afgerekend gaat 62% naar de betaalprovider.
- €20 voor een hobbybeurs is ongeveer een factor vijf te laag ten opzichte van de geleverde waarde — het advies is €99/€249.
- Definieer wat één workshopplaatsing is (listing of datum) vóór de lancering; daar hangt de hele break-even van af.
- Beste route: credits als laagdrempelige oprit, abonnementen als upgrade voor wie volume draait, met opgebouwde credits als korting op het jaarplan.
- De 10% commissie op materialen blijft in beide modellen ongewijzigd en levert in dit scenario het grootste deel van de omzet.
