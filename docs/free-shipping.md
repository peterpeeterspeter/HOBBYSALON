# Gratis standaardverzending per handelaar en land

Verkopers beheren `/settings/shipping` zelf. Het beleid is Medusa-commercegegevens;
Supabase blijft buiten de prijsberekening. BE en NL hebben elk een optionele
EUR-drempel en een lijst standaardbezorgmethodes. Leeg/null schakelt uit; nul
betekent altijd gratis. Productbedragen tellen inclusief btw, na korting en
zonder verzending mee. Verkopers worden afzonderlijk berekend. De bestaande
single-seller-winkelwagen en betaalcontrole blijven actief.

Alleen vaste EUR-methodes voor bezorging naar een volledig land worden aangeboden.
Afhalen, retouren, express en inactieve winkels worden uitgesloten. Oudere
portaalmethodes met placeholder `type-code` kunnen door de handelaar expliciet
als standaardbezorging aangewezen worden. Er worden geen bestaande zones,
basisprijzen of methodetypes gewijzigd.

## API

- `GET /vendor/shipping-policies`: eigen beleid en toepasselijke bezorgmethodes.
- `POST /vendor/shipping-policies/:country_code`: volledige instelling met
  `free_shipping_threshold` (EUR, null of een bedrag vanaf nul) en
  `shipping_option_ids`. De seller komt uitsluitend uit de ingelogde context.
- `GET /store/products/:id/shipping-policy`: alleen publieke, toepasselijke
  drempels voor een gepubliceerd product en zijn werkelijke verkoper/profiel.
- `GET /store/carts/:id/shipping-summary`: berekende voortgang per verkoper/land.
- `POST /store/carts/:id/shipping-summary/refresh`: vernieuwt uitsluitend een
  onbetaalde quote binnen de bestaande commerce-cartlock.

Publieke gegevens worden zonder cache opgehaald. Een ontbrekende/ongeldige
native prijs of verzendmethode wordt nooit alsnog gratis gemaakt. De consument
ziet "Gratis" uitsluitend bij een daadwerkelijk gekozen nulbedrag; voortgang
gebruikt "gratis standaardverzending beschikbaar".

## Prijs- en betaalbeveiliging

De refresh-hook zet eerst de actuele native basisprijs terug, zodat Medusa de
verzendkortingen ook correct verdeelt wanneer een eerder gratis winkelwagen
onder de drempel daalt. Na native productprijzen, btw en promoties bepaalt de
centrale berekening welke methodes gratis worden. Die methodes krijgen nul en
hun verzendkortingen worden soft-deleted: nul plus een resterende kortingsregel
kan in Medusa negatieve verzend- en btw-bedragen veroorzaken. Beide prijsstappen
hebben herstel bij een mislukte workflow.

De seller-workflow geeft de volledige uiteindelijke selectie in één keer aan de
native workflow door. Oude bedragen worden niet achteraf teruggekopieerd.
Nieuwe betaalinitiatie vernieuwt de quote binnen de bestaande cartlock, ook bij
een directe Store-API-call. Voor verkopers met beleid blokkeert een bestaande
betaalsessie verdere herprijzing of nieuwe initiatie. Bestaand betaalherstel,
webhooks, ordersplitsing en afgeronde orders gebruiken hun vastgelegde bedragen.

## Uitrol

1. Bouw en controleer de backend en voer de nieuwe Seller-modulemigratie uit in
   een geïsoleerde testomgeving. Ze maakt alleen opslag aan en activeert geen
   beleid voor bestaande verkopers.
2. Controleer met twee testverkopers de afzonderlijke BE/NL-instellingen,
   productprofielen, betaalbedragen en orderbevestiging.
3. Publiceer backend/API vóór portaal en storefront. Door de nieuwe refresh-API
   heeft de bijgewerkte checkout de bijgewerkte backend nodig.
4. Voer een echte Stripe-testbetaling en herstel na een geslaagde betaling uit
   vóór productie. De geïsoleerde lokale preview en echte Stripe-sandboxbetalingen
   zijn uitgevoerd; productiegegevens en livebetalingen zijn niet gewijzigd.
   Ook de zichtbare gastbevestiging is gecontroleerd met de expliciet toegestane
   tijdelijke lokale admin-API-sleutel. Deze staat uitsluitend server-side in de preview.

## Verificatie

```sh
node --experimental-strip-types --experimental-vm-modules --test \
  scripts/tests/shipping-policy.test.mjs \
  scripts/tests/shipping-integration.test.mjs \
  scripts/tests/shipping-native-totals.test.cjs \
  scripts/tests/commerce-single-seller.test.mjs \
  scripts/tests/commerce-financial-boundary.test.mjs \
  scripts/tests/commerce-payment-recovery.test.mjs \
  scripts/tests/commerce-capture-tail.test.cjs \
  scripts/tests/commerce-native-tax-payment.test.cjs \
  scripts/tests/commerce-order-confirmation.test.mjs
```

De native-totalentest gebruikt de vastgelegde Medusa 2.11.3-utilities. De
integratietests voeren de echte API-/hookcode uit met database-/workflowadapters;
ze vervangen geen Stripe- of PostgreSQL-acceptatietest.

Bij de definitieve lokale verificatie slagen 268 tests; 5 bestaande tests zijn
overgeslagen. Dit omvat verzendbeleid, echte native btw-totalen, workflowherstel,
single-seller, betaalherstel, financiële grenzen en capture-tail-herstel. De
recovery-fixture bindt nu ook de reeds bestaande webhookmiddleware; de
capture-tail-suite resolveert Redis via het geïnstalleerde package in plaats van
een vast containerpad.

Backend en storefront hebben een groene typecheck. De vendor-typecheck heeft
118 fouten die met dezelfde geïnstalleerde dependencies exact op main voorkomen;
de productie-Vite-build slaagt. Aanvullende native capture-/lock-/ACK-tests:
300 geslaagd, 25 fixture-/lockfouten die ook op main voorkomen. Dit zijn geen
nieuwe regressies; deze aanvullende suite is daarmee niet volledig groen.

De nieuwe Seller-migratie is op een eigen PostgreSQL17-database uitgevoerd en een
laatste migratiecontrole meldt alles actueel. De testfixtures activeren expliciet
BE/NL-beleid; de migratie zelf bevat geen automatische activering. Bij de eerste
bootstrap van de lege database vereiste een oudere marketplace-migratie een tweede
pass nadat de native ordermodule bestond. De nieuwe Seller-migratie slaagde;
de volgende volledige migratiecontrole slaagde zonder fouten.

De echte Store-API is gecontroleerd met 21% btw inbegrepen, grensbedragen,
land-/aantallenwijzigingen, korting van €80 naar €72, herstel van verzendkortingen,
afzonderlijke verkopers, nul/uitgeschakeld beleid, vreemde methodes, verwijderde
opties en een gecontroleerde fout bij het bijwerken van de payment collection.

Twee echte Stripe-sandboxbetalingen zijn geslaagd: €75 en €80, telkens met €0
verzending. De tweede liep via ProductBuyCard, de echte winkelwagen, checkout en
Stripe Elements. Beide orders hebben betaalstatus completed, één capture per betaling en een
volledige duurzame consumer-ACK. Herhaald voltooien en een hogere verkopersdrempel
behouden order, betaalbedrag en verzendbedrag.

De runtimecontrole heeft daarnaast de volgende gerichte correcties afgedwongen:

- Productprofielen worden uit de echte `product.shipping_profile.id`-relatie gelezen.
- De cartquery vraagt ook een carttotaal op; alleen dan decoreert Medusa de
  producttotalen met btw en kortingen.
- Ontbrekende relaties van verwijderde opties leveren geen publieke belofte op.
- Een gratis quote heeft zowel berekende als ruwe prijs nul.
- Productregels worden eerst per verkoper opgeteld en daarna eenmaal afgerond.
- De storefront-completioncall stuurt geen ongeldige order-set-queryvelden mee.
- Alleen berekende carttotalen gebruiken bij de betaalcontrole de publieke numerieke
  Medusa-DTO-waarde. Native btw kan intern 80.0000000000000000000041 bevatten waar
  API, order en payment collection 80 gebruiken. Opgeslagen betaal-/ledgerbedragen
  blijven exact vergeleken. Tests weigeren centafwijkingen en gewijzigde opgeslagen
  bedragen. Cartlocks, capture-identiteiten en snapshots blijven behouden.

De productkoopcomponent is op een tijdelijke lokale harnesspagina getest; de
Supabase-productdiscovery is niet nagebouwd. Gastcheckout gebruikt de echte
product-verkoperkoppelingen in Medusa. E-mailbezorging en payouts vallen buiten
deze verificatie. De gastbevestiging is zichtbaar bevestigd met het juiste ordernummer.
De tijdelijke `MEDUSA_ADMIN_API_TOKEN` is na expliciete toestemming uitsluitend
server-side in de lokale preview ingesteld. Medusa-API-sleutels gebruiken Basic;
bestaande admin-JWTs blijven Bearer gebruiken. Vier regressietests controleren
het juiste authenticatieformaat, minimale gastinformatie en weigering bij
ontbrekende credentials of een mislukte backendcontrole. Er is niets gedeployd.
