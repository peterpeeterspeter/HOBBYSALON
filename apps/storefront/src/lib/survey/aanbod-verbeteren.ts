export const SURVEY_KEY = "aanbod-verbeteren-2026";

export const ACTIVITY_TYPES = [
  "content",
  "handmade",
  "workshop",
  "webshop",
  "hobbybeurs",
  "makers_market",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type QuestionKind = "single" | "multi" | "scale" | "text" | "textarea";

export type SurveyOption = {
  value: string;
  label: string;
  other?: boolean;
};

export type SurveyQuestion = {
  id: string;
  label: string;
  kind: QuestionKind;
  required?: boolean;
  maxSelections?: number;
  helper?: string;
  options?: SurveyOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  placeholder?: string;
};

export type RoleSection = {
  activityType: ActivityType;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  content: "Ik publiceer tutorials, projecten, patronen, reviews of creatieve video's",
  handmade: "Ik verkoop zelfgemaakte creaties als maker",
  workshop: "Ik geef creatieve workshops",
  webshop: "Ik verkoop creatieve materialen via een webshop",
  hobbybeurs: "Ik organiseer een hobbybeurs",
  makers_market: "Ik organiseer een makers market",
};

export const ROLE_SECTION_TITLES: Record<ActivityType, string> = {
  content: "Content creators",
  handmade: "P2P-makers",
  workshop: "Workshops",
  webshop: "Webshops voor creatieve materialen",
  hobbybeurs: "Hobbybeurzen",
  makers_market: "Makers markets",
};

const LIKELIHOOD_OPTIONS: SurveyOption[] = [
  { value: "zeer_waarschijnlijk", label: "Zeer waarschijnlijk" },
  { value: "waarschijnlijk", label: "Waarschijnlijk" },
  { value: "misschien", label: "Misschien" },
  { value: "waarschijnlijk_niet", label: "Waarschijnlijk niet" },
  { value: "zeker_niet", label: "Zeker niet" },
  { value: "meer_info", label: "Ik heb meer informatie nodig" },
];

const LIKELIHOOD_DEPENDS_OPTIONS: SurveyOption[] = [
  { value: "zeer_waarschijnlijk", label: "Zeer waarschijnlijk" },
  { value: "waarschijnlijk", label: "Waarschijnlijk" },
  { value: "misschien", label: "Misschien" },
  { value: "waarschijnlijk_niet", label: "Waarschijnlijk niet" },
  { value: "zeker_niet", label: "Zeker niet" },
  { value: "hangt_af", label: "Dat hangt volledig af van wat inbegrepen is" },
];

export const SHARED_QUESTIONS: {
  activityTypes: SurveyQuestion;
  activityStatus: SurveyQuestion;
  outcomes: SurveyQuestion;
} = {
  activityTypes: {
    id: "activity_types",
    label: "Over welke onderdelen van uw activiteiten wilt u feedback geven?",
    kind: "multi",
    required: true,
    helper:
      "Selecteer alle rollen die voor u van toepassing zijn. Heeft u meerdere activiteiten? Vink ze allemaal aan — we stellen per rol een paar vragen.",
    options: ACTIVITY_TYPES.map((type) => ({
      value: type,
      label: ACTIVITY_TYPE_LABELS[type],
    })),
  },
  activityStatus: {
    id: "activity_status",
    label: "Bent u vandaag al actief met dit aanbod?",
    kind: "single",
    required: true,
    options: [
      { value: "professioneel", label: "Ja, professioneel" },
      { value: "bijberoep", label: "Ja, als zelfstandige in bijberoep" },
      { value: "hobby", label: "Ja, als hobby" },
      { value: "opstart", label: "Ik ben bezig met de opstart" },
      { value: "overweeg", label: "Nog niet, maar ik overweeg het" },
    ],
  },
  outcomes: {
    id: "outcomes",
    label: "Wat zou Hobbysalon u vooral moeten opleveren?",
    kind: "multi",
    required: true,
    maxSelections: 2,
    options: [
      { value: "zichtbaarheid", label: "Meer zichtbaarheid bij een relevante doelgroep" },
      { value: "aanvragen", label: "Meer aanvragen of klanten" },
      { value: "verkoop", label: "Meer verkoop" },
      { value: "online_aanwezigheid", label: "Een professionele online aanwezigheid" },
      { value: "beheer", label: "Eenvoudiger beheer van mijn aanbod" },
      { value: "promotie", label: "Promotie via inspiratiepagina's, nieuwsbrieven of sociale media" },
      { value: "inzicht", label: "Inzicht in bezoeken, clicks, aanvragen of verkopen" },
      { value: "inkomsten_content", label: "Inkomsten uit mijn creatieve content" },
      { value: "anders", label: "Anders, namelijk: …", other: true },
    ],
  },
};

export const ROLE_SECTIONS: RoleSection[] = [
  {
    activityType: "content",
    title: ROLE_SECTION_TITLES.content,
    description: "Vragen over tutorials, projecten, patronen, reviews of video's.",
    questions: [
      {
        id: "content_types",
        label: "Welke content maakt of deelt u?",
        kind: "multi",
        options: [
          { value: "tutorials", label: "Stap-voor-staptutorials" },
          { value: "projecten", label: "Creatieve projecten" },
          { value: "patronen", label: "Patronen of downloads" },
          { value: "reviews", label: "Productreviews" },
          { value: "inspiratie", label: "Inspiratieartikelen" },
          { value: "videos", label: "Video's" },
          { value: "materiaaltesten", label: "Materiaaltesten" },
          { value: "geen_content", label: "Ik maak momenteel nog geen content" },
          { value: "anders", label: "Anders, namelijk: …", other: true },
        ],
      },
      {
        id: "publish_free",
        label:
          "Zou u gratis creatieve content op Hobbysalon publiceren wanneer gebruikte materialen automatisch aan producten en winkels worden gekoppeld?",
        kind: "single",
        options: [
          { value: "ja_zeker", label: "Ja, zeker" },
          { value: "waarschijnlijk_wel", label: "Waarschijnlijk wel" },
          { value: "misschien", label: "Misschien" },
          { value: "waarschijnlijk_niet", label: "Waarschijnlijk niet" },
          { value: "nee", label: "Nee" },
          { value: "meer_info", label: "Ik heb meer informatie nodig" },
        ],
      },
      {
        id: "motivators",
        label: "Welke voordelen zouden u het meest motiveren om content te publiceren?",
        kind: "multi",
        maxSelections: 3,
        options: [
          { value: "affiliate", label: "Affiliate-inkomsten op verkochte materialen" },
          { value: "bezoekers", label: "Meer bezoekers voor mijn eigen website of sociale kanalen" },
          { value: "profiel", label: "Een professioneel makersprofiel" },
          { value: "workshops", label: "Promotie van mijn workshops" },
          { value: "creaties", label: "Promotie van mijn creaties of patronen" },
          { value: "ai_hulp", label: "AI-hulp bij teksten, materialenlijsten of vertalingen" },
          { value: "statistieken", label: "Inzicht in bezoekers, clicks en opbrengsten" },
          { value: "bereik", label: "Bereik via Hobbysalon, nieuwsbrief en sociale media" },
        ],
      },
      {
        id: "affiliate_split",
        label: "Welke verdeling van de netto affiliate-opbrengst zou u redelijk vinden?",
        kind: "single",
        options: [
          { value: "80_20", label: "80% voor de creator / 20% voor Hobbysalon" },
          { value: "70_30", label: "70% voor de creator / 30% voor Hobbysalon" },
          { value: "60_40", label: "60% voor de creator / 40% voor Hobbysalon" },
          { value: "minder_belangrijk", label: "De verdeling is minder belangrijk dan het totale bereik en de opbrengst" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
      {
        id: "credits_features",
        label: "Voor welke extra functies zou u eventueel credits gebruiken?",
        kind: "multi",
        options: [
          { value: "ai_schrijven", label: "AI-hulp bij het schrijven" },
          { value: "materialen", label: "Automatisch herkennen van materialen" },
          { value: "vertalingen", label: "Vertalingen" },
          { value: "ai_afbeeldingen", label: "AI-afbeeldingen" },
          { value: "seo", label: "SEO-optimalisatie" },
          { value: "zichtbaarheid", label: "Extra zichtbaarheid" },
          { value: "promotie", label: "Promotie via nieuwsbrief of sociale media" },
          { value: "statistieken", label: "Uitgebreide statistieken" },
          { value: "geen", label: "Geen van deze functies" },
        ],
      },
    ],
  },
  {
    activityType: "handmade",
    title: ROLE_SECTION_TITLES.handmade,
    description: "Vragen over het verkopen van zelfgemaakte creaties.",
    questions: [
      {
        id: "listing_count",
        label: "Hoeveel verschillende creaties zou u gemiddeld tegelijk willen aanbieden?",
        kind: "single",
        options: [
          { value: "1_3", label: "1 tot 3" },
          { value: "4_5", label: "4 tot 5" },
          { value: "6_10", label: "6 tot 10" },
          { value: "meer_10", label: "Meer dan 10" },
          { value: "weet_niet", label: "Ik weet het nog niet" },
        ],
      },
      {
        id: "credit_model_appeal",
        label:
          "Hobbysalon wil makers maximaal 10 actieve advertenties laten plaatsen, zonder commissie op de verkoop. Voor iedere maand zichtbaarheid gebruikt een advertentie 1 credit. Hoe aantrekkelijk vindt u dit model?",
        kind: "scale",
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "1 = helemaal niet aantrekkelijk",
        scaleMaxLabel: "5 = zeer aantrekkelijk",
      },
      {
        id: "credit_price",
        label: "Wat vindt u een redelijke prijs voor voldoende credits om 10 advertenties één maand zichtbaar te houden?",
        kind: "single",
        options: [
          { value: "minder_dan_1", label: "Minder dan €1" },
          { value: "1_euro", label: "€1" },
          { value: "2_euro", label: "€2" },
          { value: "3_5", label: "€3 tot €5" },
          { value: "meer_5", label: "Meer dan €5" },
          { value: "gratis", label: "Ik wil uitsluitend gratis advertenties" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
      {
        id: "min_features",
        label: "Welke functies heeft u minimaal nodig?",
        kind: "multi",
        maxSelections: 4,
        options: [
          { value: "productpagina", label: "Productpagina met foto's en omschrijving" },
          { value: "prijs", label: "Prijsvermelding" },
          { value: "contact", label: "Contact- of aanvraagformulier" },
          { value: "links", label: "Link naar mijn eigen website of sociale media" },
          { value: "profiel", label: "Vermelding op mijn makersprofiel" },
          { value: "materialen", label: "Koppeling met gebruikte materialen" },
          { value: "statistieken", label: "Statistieken over bezoeken en clicks" },
          { value: "uitlichten", label: "Mogelijkheid om advertenties extra uit te lichten" },
        ],
      },
      {
        id: "visibility_credits",
        label: "Voor welke extra zichtbaarheid zou u credits gebruiken?",
        kind: "multi",
        options: [
          { value: "categorie", label: "Bovenaan in een categorie" },
          { value: "regio", label: "Extra zichtbaarheid in mijn regio" },
          { value: "homepage", label: "Uitgelicht op de homepage" },
          { value: "nieuwsbrief", label: "Promotie in de nieuwsbrief" },
          { value: "social", label: "Promotie via sociale media" },
          { value: "ai", label: "AI-foto's of AI-beschrijvingen" },
          { value: "geen", label: "Ik zou geen extra credits gebruiken" },
        ],
      },
      {
        id: "monthly_spend",
        label: "Hoeveel zou u maximaal per maand besteden aan advertenties en extra zichtbaarheid?",
        kind: "single",
        options: [
          { value: "niets", label: "Niets" },
          { value: "minder_5", label: "Minder dan €5" },
          { value: "5_10", label: "€5 tot €10" },
          { value: "11_20", label: "€11 tot €20" },
          { value: "meer_20", label: "Meer dan €20" },
          { value: "afhankelijk", label: "Dat hangt af van het aantal verkopen" },
        ],
      },
    ],
  },
  {
    activityType: "workshop",
    title: ROLE_SECTION_TITLES.workshop,
    description: "Vragen over het geven van creatieve workshops.",
    questions: [
      {
        id: "frequency",
        label: "Hoe vaak organiseert u gemiddeld workshops?",
        kind: "single",
        options: [
          { value: "minder_maand", label: "Minder dan één keer per maand" },
          { value: "1_2", label: "Eén tot twee keer per maand" },
          { value: "3_5", label: "Drie tot vijf keer per maand" },
          { value: "meer_5", label: "Meer dan vijf keer per maand" },
          { value: "niet_gestart", label: "Ik ben nog niet gestart" },
        ],
      },
      {
        id: "avg_price",
        label: "Wat betaalt één deelnemer gemiddeld voor uw workshop?",
        kind: "single",
        options: [
          { value: "minder_25", label: "Minder dan €25" },
          { value: "25_39", label: "€25 tot €39" },
          { value: "40_59", label: "€40 tot €59" },
          { value: "60_79", label: "€60 tot €79" },
          { value: "80_plus", label: "€80 of meer" },
          { value: "verschilt", label: "De prijs verschilt sterk per workshop" },
          { value: "niet_gestart", label: "Ik ben nog niet gestart" },
        ],
      },
      {
        id: "listing_likelihood",
        label:
          "Een workshopvermelding op Hobbysalon: tot 1 oktober mag je er 3 gratis plaatsen (blijven gratis). Extra vermeldingen kosten €9,99 voor twee maanden zichtbaar. Hobbysalon rekent geen commissie per deelnemer. Hoe waarschijnlijk is het dat u dit zou gebruiken?",
        kind: "single",
        options: LIKELIHOOD_OPTIONS,
      },
      {
        id: "min_features",
        label: "Wat moet een workshopvermelding minimaal bevatten?",
        kind: "multi",
        maxSelections: 4,
        options: [
          { value: "workshoppagina", label: "Eigen workshoppagina met foto's en beschrijving" },
          { value: "datums", label: "Datum en beschikbare sessies" },
          { value: "prijs_locatie", label: "Prijs, locatie en doelgroep" },
          { value: "boekingslink", label: "Link naar mijn eigen boekingspagina" },
          { value: "contact", label: "Contact- of aanvraagformulier" },
          { value: "profiel", label: "Vermelding op mijn makersprofiel" },
          { value: "materialen", label: "Benodigde materialen" },
          { value: "tutorials", label: "Koppeling met relevante tutorials en projecten" },
          { value: "statistieken", label: "Statistieken over bezoeken en clicks" },
        ],
      },
      {
        id: "renewal_result",
        label: "Welk resultaat zou u nodig hebben om de vermelding na twee maanden te verlengen?",
        kind: "single",
        options: [
          { value: "1_aanvraag", label: "Eén relevante aanvraag" },
          { value: "1_deelnemer", label: "Eén extra deelnemer" },
          { value: "2_3_deelnemers", label: "Twee tot drie extra deelnemers" },
          { value: "4_plus", label: "Vier of meer extra deelnemers" },
          { value: "bezoekers_website", label: "Voldoende relevante bezoekers naar mijn eigen website" },
          { value: "zichtbaarheid", label: "Extra zichtbaarheid is voldoende, ook zonder directe aanvraag" },
          { value: "weet_niet", label: "Ik weet het nog niet" },
        ],
      },
      {
        id: "optional_promo",
        label: "Welke optionele promotie zou u overwegen?",
        kind: "multi",
        options: [
          { value: "zoekresultaten", label: "Bovenaan in zoekresultaten" },
          { value: "regio", label: "Extra zichtbaarheid in mijn regio" },
          { value: "inspiratie", label: "Uitgelicht op een relevante inspiratiepagina" },
          { value: "nieuwsbrief", label: "Vermelding in de nieuwsbrief" },
          { value: "social", label: "Promotie via sociale media" },
          { value: "homepage", label: "Uitgelicht op de homepage" },
          { value: "geen", label: "Geen extra promotie" },
        ],
      },
      {
        id: "extra_spend",
        label: "Hoeveel zou u maximaal extra besteden aan de promotie van één workshop?",
        kind: "single",
        options: [
          { value: "niets", label: "Niets" },
          { value: "minder_10", label: "Minder dan €10" },
          { value: "10_24", label: "€10 tot €24" },
          { value: "25_49", label: "€25 tot €49" },
          { value: "50_plus", label: "€50 of meer" },
          { value: "bij_resultaat", label: "Alleen wanneer eerder resultaat is aangetoond" },
        ],
      },
    ],
  },
  {
    activityType: "webshop",
    title: ROLE_SECTION_TITLES.webshop,
    description: "Vragen over het verkopen van creatieve materialen.",
    questions: [
      {
        id: "assortment_size",
        label: "Hoeveel producten bevat uw assortiment ongeveer?",
        kind: "single",
        options: [
          { value: "minder_50", label: "Minder dan 50" },
          { value: "50_249", label: "50 tot 249" },
          { value: "250_999", label: "250 tot 999" },
          { value: "1000_4999", label: "1.000 tot 4.999" },
          { value: "5000_plus", label: "5.000 of meer" },
          { value: "niet_gestart", label: "Ik ben nog niet gestart" },
        ],
      },
      {
        id: "context_interest",
        label:
          "Via Hobbysalon kunnen producten verschijnen naast relevante tutorials, projecten en workshops. Hoe interessant is dat voor uw webshop?",
        kind: "scale",
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "1 = helemaal niet interessant",
        scaleMaxLabel: "5 = zeer interessant",
      },
      {
        id: "commission_likelihood",
        label:
          "Hobbysalon overweegt een gratis instapmodel met 10% commissie op verkopen die via het platform ontstaan. Hoe waarschijnlijk is het dat u dit zou gebruiken?",
        kind: "single",
        options: LIKELIHOOD_OPTIONS,
      },
      {
        id: "commission_services",
        label: "Welke diensten moeten inbegrepen zijn om 10% commissie te verantwoorden?",
        kind: "multi",
        maxSelections: 4,
        options: [
          { value: "nieuwe_klanten", label: "Hobbysalon brengt aantoonbaar nieuwe klanten aan" },
          { value: "beheer", label: "Productbeheer en voorraadbeheer" },
          { value: "betalingen", label: "Betalingen via Hobbysalon" },
          { value: "bestellingen", label: "Bestel- en klantoverzicht" },
          { value: "verzending", label: "Verzendingen en retouren beheren" },
          { value: "feed", label: "Automatische productfeed" },
          { value: "zichtbaarheid", label: "Zichtbaarheid naast tutorials en workshops" },
          { value: "statistieken", label: "Verkoopstatistieken" },
          { value: "promotie", label: "Promotie via nieuwsbrief of sociale media" },
        ],
      },
      {
        id: "pricing_model",
        label: "Welk prijsmodel heeft uw voorkeur?",
        kind: "single",
        options: [
          { value: "commissie_10", label: "Geen maandelijkse kost en 10% commissie" },
          { value: "laag_abonnement", label: "Een lage maandelijkse kost met een lagere commissie" },
          { value: "affiliate", label: "Alleen affiliate-links naar mijn bestaande webshop" },
          { value: "vast_abonnement", label: "Een vaste maandprijs zonder commissie" },
          { value: "advertenties", label: "Alleen betalen voor advertenties en extra zichtbaarheid" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
      {
        id: "extra_services",
        label: "Voor welke extra diensten zou u afzonderlijk betalen?",
        kind: "multi",
        options: [
          { value: "hogere_positie", label: "Hogere positie bij een product" },
          { value: "sponsoring", label: "Categorie- of merksponsoring" },
          { value: "feed", label: "Realtime voorraad- en prijsfeed" },
          { value: "tutorial_promo", label: "Productpromotie in tutorials" },
          { value: "nieuwsbrief", label: "Nieuwsbriefcampagne" },
          { value: "advertenties", label: "Advertenties" },
          { value: "analyses", label: "Uitgebreide analyses" },
          { value: "api", label: "API-koppeling" },
          { value: "geen", label: "Geen van deze diensten" },
        ],
      },
    ],
  },
  {
    activityType: "hobbybeurs",
    title: ROLE_SECTION_TITLES.hobbybeurs,
    description: "Vragen over het organiseren van een hobbybeurs.",
    questions: [
      {
        id: "visitors",
        label: "Hoeveel bezoekers ontvangt uw beurs gemiddeld?",
        kind: "single",
        options: [
          { value: "minder_500", label: "Minder dan 500" },
          { value: "500_1499", label: "500 tot 1.499" },
          { value: "1500_4999", label: "1.500 tot 4.999" },
          { value: "5000_9999", label: "5.000 tot 9.999" },
          { value: "10000_plus", label: "10.000 of meer" },
          { value: "nieuw", label: "Het evenement is nieuw" },
        ],
      },
      {
        id: "promo_likelihood",
        label:
          "Een uitgebreid promotiepakket voor een hobbybeurs kost €50 per maand. Hoe waarschijnlijk is het dat u dit zou gebruiken?",
        kind: "single",
        options: LIKELIHOOD_DEPENDS_OPTIONS,
      },
      {
        id: "min_includes",
        label: "Welke onderdelen moeten minimaal inbegrepen zijn?",
        kind: "multi",
        maxSelections: 4,
        options: [
          { value: "beurspagina", label: "Uitgebreide beurs- en programmapagina" },
          { value: "kalender", label: "Vermelding in de evenementenkalender" },
          { value: "inspiratie", label: "Promotie op relevante inspiratiepagina's" },
          { value: "nieuwsbrief", label: "Vermelding in de nieuwsbrief" },
          { value: "social", label: "Promotie via sociale media" },
          { value: "standhouders", label: "Mogelijkheid voor standhouders om hun aanwezigheid te tonen" },
          { value: "workshops", label: "Mogelijkheid om workshops en demonstraties te publiceren" },
          { value: "statistieken", label: "Statistieken over bezoeken en doorkliks" },
          { value: "extra_zichtbaarheid", label: "Extra zichtbaarheid vlak voor het evenement" },
        ],
      },
      {
        id: "promo_duration",
        label: "Hoe lang voor de beurs zou u het promotiepakket activeren?",
        kind: "single",
        options: [
          { value: "1_maand", label: "Eén maand" },
          { value: "2_maanden", label: "Twee maanden" },
          { value: "3_maanden", label: "Drie maanden" },
          { value: "4_6_maanden", label: "Vier tot zes maanden" },
          { value: "langer_6", label: "Langer dan zes maanden" },
          { value: "laatste_weken", label: "Alleen gedurende de laatste weken" },
        ],
      },
      {
        id: "renewal_result",
        label: "Welk resultaat zou u nodig hebben om opnieuw te betalen?",
        kind: "multi",
        maxSelections: 2,
        options: [
          { value: "bezoekers_website", label: "Meer bezoekers op de beurswebsite" },
          { value: "tickets", label: "Meer ticketverkopen" },
          { value: "standhouders", label: "Meer inschrijvingen van standhouders" },
          { value: "bereik", label: "Meer bereik bij een relevante doelgroep" },
          { value: "nieuwsbrief", label: "Meer nieuwsbriefinschrijvingen" },
          { value: "cijfers", label: "Duidelijke cijfers over bereik en clicks" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
    ],
  },
  {
    activityType: "makers_market",
    title: ROLE_SECTION_TITLES.makers_market,
    description: "Vragen over het organiseren van een makers market.",
    questions: [
      {
        id: "visitors",
        label: "Hoeveel bezoekers verwacht of ontvangt uw makers market gemiddeld?",
        kind: "single",
        options: [
          { value: "minder_250", label: "Minder dan 250" },
          { value: "250_499", label: "250 tot 499" },
          { value: "500_999", label: "500 tot 999" },
          { value: "1000_2499", label: "1.000 tot 2.499" },
          { value: "2500_plus", label: "2.500 of meer" },
          { value: "nieuw", label: "Het evenement is nieuw" },
        ],
      },
      {
        id: "promo_likelihood",
        label:
          "Een volledig promotiepakket voor één makers market kost €69. Hoe waarschijnlijk is het dat u dit zou gebruiken?",
        kind: "single",
        options: LIKELIHOOD_DEPENDS_OPTIONS,
      },
      {
        id: "min_includes",
        label: "Welke onderdelen moeten minimaal inbegrepen zijn?",
        kind: "multi",
        maxSelections: 4,
        options: [
          { value: "eventpagina", label: "Uitgebreide eventpagina" },
          { value: "kalender", label: "Vermelding in de evenementenkalender" },
          { value: "inspiratie", label: "Promotie op relevante inspiratiepagina's" },
          { value: "nieuwsbrief", label: "Vermelding in de nieuwsbrief" },
          { value: "social", label: "Promotie via sociale media" },
          { value: "makers", label: "Mogelijkheid voor makers om hun deelname te tonen" },
          { value: "workshops", label: "Overzicht van workshops of demonstraties" },
          { value: "statistieken", label: "Statistieken over bezoeken en doorkliks" },
        ],
      },
      {
        id: "fair_price",
        label: "Wat zou voor u een redelijke prijs zijn voor dit volledige promotiepakket?",
        kind: "single",
        options: [
          { value: "minder_25", label: "Minder dan €25" },
          { value: "25_49", label: "€25 tot €49" },
          { value: "50_69", label: "€50 tot €69" },
          { value: "70_99", label: "€70 tot €99" },
          { value: "100_plus", label: "€100 of meer" },
          { value: "gratis", label: "Ik zou alleen een gratis basisvermelding gebruiken" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
      {
        id: "renewal_result",
        label: "Welk resultaat zou u nodig hebben om bij een volgend evenement opnieuw te betalen?",
        kind: "multi",
        maxSelections: 2,
        options: [
          { value: "bezoekers_website", label: "Meer bezoekers op de website" },
          { value: "bezoekers_event", label: "Meer bezoekers op het evenement" },
          { value: "standhouders", label: "Meer aanvragen van standhouders" },
          { value: "bereik", label: "Meer bereik bij een relevante doelgroep" },
          { value: "nieuwsbrief", label: "Meer nieuwsbriefinschrijvingen" },
          { value: "cijfers", label: "Duidelijke cijfers over bereik en clicks" },
          { value: "weet_niet", label: "Ik weet het niet" },
        ],
      },
    ],
  },
];

export const CLOSING_QUESTIONS: SurveyQuestion[] = [
  {
    id: "missing",
    label: "Wat ontbreekt volgens u nog in het voorgestelde aanbod?",
    kind: "textarea",
    required: false,
    placeholder: "Uw opmerkingen (optioneel)",
  },
  {
    id: "contact_ok",
    label: "Mogen we u contacteren voor een korte test of een gesprek over Hobbysalon?",
    kind: "single",
    required: true,
    options: [
      { value: "ja", label: "Ja" },
      { value: "nee", label: "Nee" },
    ],
  },
  {
    id: "contact_name",
    label: "Uw naam",
    kind: "text",
    required: false,
    placeholder: "Optioneel",
  },
  {
    id: "contact_email",
    label: "Uw e-mailadres",
    kind: "text",
    required: false,
    helper:
      "Verplicht wanneer u contact wilt. Uw contactgegevens worden alleen gebruikt voor onderzoek naar Hobbysalon en niet automatisch toegevoegd aan een nieuwsbrief.",
    placeholder: "naam@voorbeeld.be",
  },
];

export type SurveyAnswers = {
  activity_types: ActivityType[];
  activity_status: string;
  outcomes: string[];
  outcomes_other?: string;
  roles: Partial<Record<ActivityType, Record<string, unknown>>>;
  closing: {
    missing?: string;
    contact_ok: "ja" | "nee";
    contact_name?: string;
    contact_email?: string;
  };
};

export function getRoleSection(activityType: ActivityType): RoleSection | undefined {
  return ROLE_SECTIONS.find((section) => section.activityType === activityType);
}

export function getOrderedRoleSections(selected: ActivityType[]): RoleSection[] {
  return ROLE_SECTIONS.filter((section) => selected.includes(section.activityType));
}

export type SurveyStep =
  | { kind: "intro" }
  | { kind: "shared" }
  | { kind: "role"; activityType: ActivityType }
  | { kind: "closing" };

export function buildSurveySteps(selected: ActivityType[]): SurveyStep[] {
  const steps: SurveyStep[] = [{ kind: "intro" }, { kind: "shared" }];
  for (const section of getOrderedRoleSections(selected)) {
    steps.push({ kind: "role", activityType: section.activityType });
  }
  steps.push({ kind: "closing" });
  return steps;
}

export function getStepTitle(step: SurveyStep): string {
  switch (step.kind) {
    case "intro":
      return "Over uw aanbod";
    case "shared":
      return "Over uw aanbod";
    case "role":
      return ROLE_SECTION_TITLES[step.activityType];
    case "closing":
      return "Afsluiting";
  }
}
