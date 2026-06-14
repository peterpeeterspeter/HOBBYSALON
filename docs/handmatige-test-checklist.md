# Hobbysalon — Handmatige testchecklist

**Website:** https://www.hobbysalon.be  
**Datum test:** _______________  
**Getest door:** _______________  
**Browser:** ☐ Chrome  ☐ Safari  ☐ Firefox  ☐ Edge  ☐ Telefoon

> **Tip:** Gebruik voor elke nieuwe test een **privévenster** (incognito) of een **nieuw e-mailadres**, zodat je resultaten niet door oude inloggegevens worden beïnvloed.

---

## Snel overzicht — wat test je?

| Onderdeel | Adres | Wat is het? |
|-----------|-------|-------------|
| Publieke website | www.hobbysalon.be | Shoppen, ontdekken, registreren |
| Verkopersportaal | verkoper.hobbysalon.be | Voor verkopers: bestellingen, voorraad, uitbetalingen |
| Mijn account | www.hobbysalon.be/dashboard | Profiel, producten en workshops beheren |

---

## Voor je begint (2 minuten)

| ☐ | Controle |
|---|----------|
| ☐ | De homepage opent zonder foutmelding |
| ☐ | Het logo staat bovenaan en ziet er goed uit |
| ☐ | Je test op een computer én (indien mogelijk) op je telefoon |

**Als de homepage niet opent:** stop hier en meld dit eerst.

---

## Deel 1 — Bezoeker zonder account

*Je bent niet ingelogd. Klik rond alsof je een nieuwe bezoeker bent.*

### Navigatie en uiterlijk

| ☐ | Actie | Verwacht resultaat |
|---|--------|-------------------|
| ☐ | Open de homepage | Pagina laadt volledig, geen wit scherm of “Application error” |
| ☐ | Klik op het logo | Je komt terug op de homepage |
| ☐ | Klik op **Workshops** in het menu | Overzichtspagina met workshops |
| ☐ | Klik op **Agenda** | Kalender of lijst met evenementen |
| ☐ | Klik op **Materialen** | Overzicht van materialen |
| ☐ | Klik op **Creators** | Overzicht van makers |
| ☐ | Open het menu **Per Hobby** en kies een hobby (bv. Breien of Haken) | Hobby-pagina opent |
| ☐ | Scroll naar de footer en klik op een link | De link werkt |

### Belangrijke pagina’s (open elk adres in de adresbalk of via links)

| ☐ | Pagina | Adres (achter www.hobbysalon.be) | Verwacht resultaat |
|---|--------|----------------------------------|-------------------|
| ☐ | Makerprofiel | `/creator/brei-atelier` | Profiel met foto, naam en tabbladen (geen foutpagina) |
| ☐ | Handgemaakt product | `/product/gebreide-deken` | Foto, prijs en knop **In winkelwagen** |
| ☐ | Product uit catalogus | `/product/handmade-crochet-scarf` | Foto, prijs en knop **In winkelwagen** |
| ☐ | Hobby-pagina | `/knitting` of `/crochet` | Overzicht met producten en/of makers |

### Zoeken

| ☐ | Actie | Verwacht resultaat |
|---|--------|-------------------|
| ☐ | Zoek op “deken” via de zoekbalk | Er verschijnen resultaten (of een duidelijke “geen resultaten”-melding) |

**Opmerkingen deel 1:**

_______________________________________________________________________________

_______________________________________________________________________________

---

## Deel 2 — Nieuw account aanmaken (gewone bezoeker)

*Gebruik een nieuw e-mailadres dat je kunt controleren, bv. `jouwnaam+test1@gmail.com`.*

### Registreren en inloggen

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Ga naar **Registreren** (of `/register`) | Formulier verschijnt |
| ☐ | Vul e-mail en wachtwoord in en verstuur | Bevestiging of doorverwijzing (geen foutmelding) |
| ☐ | Controleer je e-mail (indien gevraagd) | Bevestigingslink werkt; je bent daarna ingelogd |
| ☐ | Log uit en log opnieuw in via **Inloggen** | Inloggen lukt met hetzelfde wachtwoord |
| ☐ | Vul onboarding in (postcode, interesses) als je daar naartoe wordt gestuurd | Gegevens worden opgeslagen |

**Test-e-mail gebruikt:** _______________________________________________

**Opmerkingen deel 2:**

_______________________________________________________________________________

---

## Deel 3 — Shoppen en afrekenen

*Het belangrijkste koopproces. Gebruik een test-betaalkaart als je tot betaling komt.*

### Winkelwagen

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Open een product met **In winkelwagen** | Productpagina toont prijs en knop |
| ☐ | Klik **In winkelwagen** | Bevestiging of winkelwagen-icoon verandert |
| ☐ | Ga naar **Winkelwagen** (`/cart`) | Je product staat in de lijst met juiste prijs |
| ☐ | Pas het aantal aan of verwijder een product | Winkelwagen werkt correct |

### Afrekenen

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Klik **Afrekenen** of ga naar `/checkout` | Afrekenpagina opent (niet leeg) |
| ☐ | Vul verzendadres en e-mail in | Volgende stap wordt beschikbaar |
| ☐ | Kies een verzendoptie | Verzendkosten verschijnen in het overzicht |
| ☐ | Ga verder naar betaling | Betaalformulier (Stripe) verschijnt |
| ☐ | Betaal met testkaart **4242 4242 4242 4242** (vervaldatum in de toekomst, willekeurige CVC) | Betaling slaagt; bedankpagina verschijnt |

**Testkaart gebruikt:** 4242 4242 4242 4242  
**Bestelling gelukt?** ☐ Ja  ☐ Nee  

**Opmerkingen deel 3:**

_______________________________________________________________________________

---

## Deel 4 — Ingelogd als bezoeker (extra functies)

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Ga naar **Profiel** of `/profile` | Je accountgegevens zijn zichtbaar |
| ☐ | Klik het hartje (favoriet) op een maker- of productpagina | Favoriet wordt opgeslagen |
| ☐ | Ga naar **Favorieten** (`/favorites`) | Je opgeslagen items staan in de lijst |
| ☐ | Ga naar **Dashboard** (`/dashboard`) | Overzichtspagina opent |

**Opmerkingen deel 4:**

_______________________________________________________________________________

---

## Deel 5 — Registreren als maker (creator)

*Gebruik weer een **nieuw** e-mailadres, bv. `jouwnaam+creator1@gmail.com`.*

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Ga naar **Registreer als creator** (`/register/creator`) | Creator-formulier verschijnt |
| ☐ | Maak account aan (naam, type maker, enz.) | Je komt in het dashboard |
| ☐ | Ga naar **Mijn profiel** (`/dashboard/creator`) | Je kunt profiel bewerken |
| ☐ | Sla wijzigingen op (bio, foto, stad) | Wijzigingen blijven bewaard na verversen |
| ☐ | Open je publieke profiel (`/creator/jouw-slug`) | Bezoekers zien je profiel zoals jij het instelde |
| ☐ | Bekijk **Producten** en **Workshops** in het dashboard | Pagina’s openen zonder fout |

**Creator e-mail gebruikt:** _______________________________________________

**Opmerkingen deel 5:**

_______________________________________________________________________________

---

## Deel 6 — Registreren als verkoper (materialen)

*Nog een **nieuw** e-mailadres, bv. `jouwnaam+winkel1@gmail.com`.*

| ☐ | Stap | Verwacht resultaat |
|---|------|-------------------|
| ☐ | Ga naar **Registreer als merchant** (`/register/merchant`) | Verkoper-formulier verschijnt |
| ☐ | Rond registratie af | Je komt in het dashboard of verkopersportaal |
| ☐ | Ga naar **Mijn voorraad** (`/dashboard/materials`) | Pagina voor materialen/import opent |
| ☐ | Klik **Verkopersportaal** in het menu (`/dashboard/verkoper`) | Je wordt doorgestuurd naar verkoper.hobbysalon.be |
| ☐ | In het verkopersportaal: bekijk producten en bestellingen | Schermen laden; je bent ingelogd als verkoper |

**Als Verkopersportaal niet opent:** noteer de exacte foutmelding op de pagina.

**Verkoper e-mail gebruikt:** _______________________________________________

**Opmerkingen deel 6:**

_______________________________________________________________________________

---

## Deel 7 — Mobiel (optioneel maar aanbevolen)

| ☐ | Controle op telefoon |
|---|---------------------|
| ☐ | Homepage leesbaar en menu werkt |
| ☐ | Productpagina: **In winkelwagen** is klikbaar |
| ☐ | Winkelwagen en afrekenen zijn bruikbaar |
| ☐ | Makerprofiel laadt zonder fout |

**Opmerkingen deel 7:**

_______________________________________________________________________________

---

## Deel 8 — Wat extra aandacht verdient

*Deze punten zijn in het verleden problemen gegeven — controleer ze zeker.*

| ☐ | Punt | OK? | Opmerking |
|---|------|-----|-----------|
| ☐ | Makerprofiel opent zonder “Application error” | ☐ | |
| ☐ | Handgemaakt product toont **In winkelwagen** (niet “nog niet beschikbaar”) | ☐ | |
| ☐ | Afrekenen toont verzendopties (niet leeg) | ☐ | |
| ☐ | Verkopersportaal opent na klik op **Verkopersportaal** | ☐ | |
| ☐ | Logo ziet er goed uit (header + footer) | ☐ | |

---

## Fouten noteren

*Vul één regel per probleem in. Je hoeft geen technische termen te kennen — beschrijf wat je deed en wat je zag.*

| # | Pagina (adres in browser) | Wat deed je? | Wat verwachtte je? | Wat zag je? | Ernst |
|---|---------------------------|--------------|-------------------|-------------|-------|
| 1 | | | | | ☐ Ernstig  ☐ Gemiddeld  ☐ Klein |
| 2 | | | | | ☐ Ernstig  ☐ Gemiddeld  ☐ Klein |
| 3 | | | | | ☐ Ernstig  ☐ Gemiddeld  ☐ Klein |
| 4 | | | | | ☐ Ernstig  ☐ Gemiddeld  ☐ Klein |
| 5 | | | | | ☐ Ernstig  ☐ Gemiddeld  ☐ Klein |

**Ernst:**
- **Ernstig** — pagina werkt niet, betalen lukt niet, inloggen onmogelijk
- **Gemiddeld** — functie werkt deels of er is een oplossing via andere weg
- **Klein** — typo, kleine layout, cosmetisch

---

## Samenvatting (invullen na de test)

| Onderdeel | Resultaat |
|-----------|-----------|
| Homepage & navigatie | ☐ OK  ☐ Problemen |
| Makerprofielen & producten | ☐ OK  ☐ Problemen |
| Registreren & inloggen | ☐ OK  ☐ Problemen |
| Winkelwagen & afrekenen | ☐ OK  ☐ Problemen |
| Creator-dashboard | ☐ OK  ☐ Niet getest  ☐ Problemen |
| Verkopersportaal | ☐ OK  ☐ Niet getest  ☐ Problemen |
| Mobiel | ☐ OK  ☐ Niet getest  ☐ Problemen |

**Algemene indruk (1–2 zinnen):**

_______________________________________________________________________________

_______________________________________________________________________________

**Klaar voor live gebruik door klanten?** ☐ Ja  ☐ Bijna  ☐ Nee — zie fouten hierboven

---

## Deel 6 — Commercieel model (plans, gating, marketplace)

> Zet `COMMERCIAL_GATING_ENABLED=true` in de storefront-omgeving om link-gating en limieten te testen.

| ☐ | Actie | Verwacht resultaat |
|---|--------|-------------------|
| ☐ | Open een **handmade** productpagina | **In winkelwagen** / checkout blijft zichtbaar (marketplace ongewijzigd) |
| ☐ | Open een **supply** product via `/materials` | Product kan in winkelwagen; geen gratis externe webshoplink op basisprofiel |
| ☐ | Open creatorprofiel (free/basic plan, gating aan) | Geen website/Instagram/Facebook links; wel producten/workshops op platform |
| ☐ | Open workshopdetail (Essential, gating aan) | CTA = aanvraagformulier; geen externe boekingslink |
| ☐ | Open eventdetail (Basic, gating aan) | Geen externe ticketlink; wel standhouder-aanvraagformulier |
| ☐ | Dashboard workshops | Limiet zichtbaar (bv. 3/5 actief); 6e activatie geblokkeerd op Essential |
| ☐ | Dashboard events | Standhouder-aanvragen inbox toont ingediende leads |

**Opmerkingen deel 6:**

_______________________________________________________________________________

---

*Versie: juni 2026 — Hobbysalon handmatige testchecklist*
