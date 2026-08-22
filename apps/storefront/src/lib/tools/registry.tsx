/**
 * Central registry of all hobbysalon tools.
 * Maps slug → metadata + component.
 */

import type { ReactNode } from "react";
import { Garencalculator } from "@/components/tools/Garencalculator";
import { NaaldmaatConverter } from "@/components/tools/NaaldmaatConverter";
import { StekenproefCalculator } from "@/components/tools/StekenproefCalculator";
import { C2CDekenCalculator } from "@/components/tools/C2CDekenCalculator";
import { FotoNaarKruissteek } from "@/components/tools/FotoNaarKruissteek";
import { GarengewichtConverter } from "@/components/tools/GarengewichtConverter";
import { AlternatiefGaren } from "@/components/tools/AlternatiefGaren";
import { RestgarenCalculator } from "@/components/tools/RestgarenCalculator";
import { Garencombinator } from "@/components/tools/Garencombinator";
import { GarendikteConverter } from "@/components/tools/GarendikteConverter";
import { HaaknaaldmaatConverter } from "@/components/tools/HaaknaaldmaatConverter";
import { NaaldmaatAanbeveling } from "@/components/tools/NaaldmaatAanbeveling";
import { PatroonOmrekenen } from "@/components/tools/PatroonOmrekenen";
import { MaatAanpassen } from "@/components/tools/MaatAanpassen";
import { SpanningVariatie } from "@/components/tools/SpanningVariatie";
import { AmigurumiGrootte } from "@/components/tools/AmigurumiGrootte";
import { DekenResizer } from "@/components/tools/DekenResizer";
import { DmcKleurpalet } from "@/components/tools/DmcKleurpalet";
import { BorduurpaletGenerator } from "@/components/tools/BorduurpaletGenerator";
import { DmcAnchorConverter } from "@/components/tools/DmcAnchorConverter";
import { Kleurenmixer } from "@/components/tools/Kleurenmixer";
import { KruissteekpatroonGenerator } from "@/components/tools/KruissteekpatroonGenerator";
import { StitchChartEditor } from "@/components/tools/StitchChartEditor";
import { FiletChartMaker } from "@/components/tools/FiletChartMaker";
import { Stekenbibliotheek } from "@/components/tools/Stekenbibliotheek";
import { Projectplanner } from "@/components/tools/Projectplanner";
import { Rijenteller } from "@/components/tools/Rijenteller";
import { Kostencalculator } from "@/components/tools/Kostencalculator";
import { Tijdschatting } from "@/components/tools/Tijdschatting";
import { DeadlinePlanner } from "@/components/tools/DeadlinePlanner";
import { SokkenpatroonCalculator } from "@/components/tools/SokkenpatroonCalculator";
import { TruiconstructieWizard } from "@/components/tools/TruiconstructieWizard";
import { RaglanBerekening } from "@/components/tools/RaglanBerekening";
import { AfwerkingCalculator } from "@/components/tools/AfwerkingCalculator";
import { GrannySquarePlanner } from "@/components/tools/GrannySquarePlanner";
import { AmigurumiScaler } from "@/components/tools/AmigurumiScaler";
import { CirkelCalculator } from "@/components/tools/CirkelCalculator";
import { FoundationChain } from "@/components/tools/FoundationChain";
import { DraadlengteCalculator } from "@/components/tools/DraadlengteCalculator";
import { BorduurkaderAdvies } from "@/components/tools/BorduurkaderAdvies";

import { FormulaCalculator } from "@/components/tools/FormulaCalculator";
import {
  stofcalculatorDefinition,
  quiltcalculatorDefinition,
  kaarsenWascalculatorDefinition,
  resinCalculatorDefinition,
  kralenarmbandCalculatorDefinition,
  papierSnijcalculatorDefinition,
  workshopBreakEvenDefinition,
  type CalcFaq,
} from "@/lib/tools/engine";

export type ToolCategory =
  | "garen-draad"
  | "maat-stekenproef"
  | "naaldmaat"
  | "kleur"
  | "patroon"
  | "planning"
  | "breien"
  | "haken"
  | "borduren"
  | "naaien"
  | "kaarsen"
  | "hars"
  | "sieraden"
  | "papier"
  | "zakelijk";

export type ToolEntry = {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  categoryLabel: string;
  component: () => ReactNode;
  faqs?: CalcFaq[];
  relatedHubHref?: string;
  relatedHubLabel?: string;
};

/**
 * Serializable view of a tool — no `component` closure — safe to pass from
 * server components into client components (e.g. the tools browser).
 */
export type ToolSummary = Pick<
  ToolEntry,
  "slug" | "title" | "description" | "category" | "categoryLabel"
>;

function toSummary(t: ToolEntry): ToolSummary {
  return {
    slug: t.slug,
    title: t.title,
    description: t.description,
    category: t.category,
    categoryLabel: t.categoryLabel,
  };
}

const TOOLS: ToolEntry[] = [
  {
    slug: "garencalculator",
    title: "Garencalculator",
    description:
      "Bereken hoeveel meter of bolletjes garen je nodig hebt voor je brei- of haakproject op basis van gewicht of lengte.",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <Garencalculator />,
  },
  {
    slug: "naaldmaat-converter",
    title: "Naaldmaat converter",
    description:
      "Omrekenen tussen mm, US en UK naaldmaten. Handig bij patronen uit andere landen.",
    category: "naaldmaat",
    categoryLabel: "Naaldmaat & haaknaald",
    component: () => <NaaldmaatConverter />,
  },
  {
    slug: "stekenproef-calculator",
    title: "Stekenproef calculator",
    description:
      "Bereken hoeveel steken en rijen je nodig hebt voor een gewenste breedte en hoogte op basis van je stekenproef.",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <StekenproefCalculator />,
  },
  {
    slug: "c2c-deken-calculator",
    title: "C2C deken calculator",
    description:
      "Corner-to-corner haken: bereken het aantal blokken of de uiteindelijke afmeting van je C2C-deken.",
    category: "haken",
    categoryLabel: "Haken specifiek",
    component: () => <C2CDekenCalculator />,
  },
  {
    slug: "foto-naar-kruissteek",
    title: "Foto naar kruissteekpatroon",
    description:
      "Upload een foto en krijg een vereenvoudigd kruissteekpatroon met DMC-kleuren. Alles lokaal, geen upload.",
    category: "borduren",
    categoryLabel: "Borduren & naaldwerk",
    component: () => <FotoNaarKruissteek />,
  },
  {
    slug: "garengewicht-converter",
    title: "Garengewicht converter",
    description:
      "Omrekenen tussen gram en meter per garentype (fingering, DK, worsted, bulky, enz.).",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <GarengewichtConverter />,
  },
  {
    slug: "alternatief-garen",
    title: "Alternatief-garen calculator",
    description:
      "Het patroon vraagt merk A, jij wilt merk B — hoeveel bolletjes van B heb je nodig?",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <AlternatiefGaren />,
  },
  {
    slug: "restgaren-calculator",
    title: "Restgaren calculator",
    description:
      "Hoeveel meter zit er nog in mijn restbolletje? Weeg en bereken met meter/gram.",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <RestgarenCalculator />,
  },
  {
    slug: "garencombinator",
    title: "Garencombinator",
    description:
      "Combineer 2 of meer garens en bereken het gecombineerde gewicht per meter.",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <Garencombinator />,
  },
  {
    slug: "garendikte-converter",
    title: "Garendikte converter",
    description:
      "Nummer-systemen omzetten: Nm, Tex, Denier. Voor naaigaren en industrieel garen.",
    category: "garen-draad",
    categoryLabel: "Garen & draad",
    component: () => <GarendikteConverter />,
  },
  {
    slug: "haaknaaldmaat-converter",
    title: "Haaknaaldmaat converter",
    description:
      "Omrekenen tussen mm en US-letter voor haaknaalden. Handig bij patronen uit andere landen.",
    category: "naaldmaat",
    categoryLabel: "Naaldmaat & haaknaald",
    component: () => <HaaknaaldmaatConverter />,
  },
  {
    slug: "naaldmaat-aanbeveling",
    title: "Naaldmaat aanbeveling",
    description:
      "Kies een garengewicht en krijg de aanbevolen brei- of haaknaaldmaat.",
    category: "naaldmaat",
    categoryLabel: "Naaldmaat & haaknaald",
    component: () => <NaaldmaatAanbeveling />,
  },
  {
    slug: "patroon-omrekenen",
    title: "Patroon omrekenen",
    description:
      "Origineel patroon gauge A → jouw gauge B. Herbereken steken en rijen.",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <PatroonOmrekenen />,
  },
  {
    slug: "maat-aanpassen",
    title: "Kledingstuk maat aanpassen",
    description:
      "Maat S omzetten naar XL op basis van een schaalfactor.",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <MaatAanpassen />,
  },
  {
    slug: "spanning-variatie",
    title: "Spanning variatie",
    description:
      "Welke naaldmaat proberen om de juiste gauge te halen?",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <SpanningVariatie />,
  },
  {
    slug: "amigurumi-grootte",
    title: "Amigurumi-grootte calculator",
    description:
      "Haakwerk op schaal brengen: hoe groter wil je de pop?",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <AmigurumiGrootte />,
  },
  {
    slug: "deken-resizer",
    title: "Deken-resizer",
    description:
      "Afmeting + steken/cm → totaal steken en benodigde rijen.",
    category: "maat-stekenproef",
    categoryLabel: "Maat, stekenproef & patroongrootte",
    component: () => <DekenResizer />,
  },
  {
    slug: "dmc-kleurpalet",
    title: "DMC-kleurpalet generator",
    description:
      "Upload een foto en krijg een set passende DMC-kleuren.",
    category: "kleur",
    categoryLabel: "Kleur & draadkleur",
    component: () => <DmcKleurpalet />,
  },
  {
    slug: "borduurpalet-generator",
    title: "Borduurpalet generator",
    description:
      "Kies een kleur en vind harmonische DMC/Anchor-combinaties.",
    category: "kleur",
    categoryLabel: "Kleur & draadkleur",
    component: () => <BorduurpaletGenerator />,
  },
  {
    slug: "dmc-anchor-converter",
    title: "DMC ↔ Anchor converter",
    description:
      "Zoek het dichtstbijzijnde equivalent in het andere merksysteem.",
    category: "kleur",
    categoryLabel: "Kleur & draadkleur",
    component: () => <DmcAnchorConverter />,
  },
  {
    slug: "kleurenmixer",
    title: "Kleurenmixer simulator",
    description:
      "Wat geeft garen A + garen B samen voor kleur? Visuele mix.",
    category: "kleur",
    categoryLabel: "Kleur & draadkleur",
    component: () => <Kleurenmixer />,
  },
  {
    slug: "kruissteekpatroon-generator",
    title: "Kruissteekpatroon generator",
    description:
      "Upload een foto en maak een kruissteekpatroon met DMC-kleuren en symboollegende.",
    category: "patroon",
    categoryLabel: "Patroonmaking & grafieken",
    component: () => <KruissteekpatroonGenerator />,
  },
  {
    slug: "stitch-chart-editor",
    title: "Stekenpatroon tekenen",
    description:
      "Teken je eigen stekenpatroon in een grid met kleur of symbool.",
    category: "patroon",
    categoryLabel: "Patroonmaking & grafieken",
    component: () => <StitchChartEditor />,
  },
  {
    slug: "filet-chart-maker",
    title: "Filetpatroon maken",
    description:
      "Raster met open of gevulde vakken voor filethaakwerk.",
    category: "patroon",
    categoryLabel: "Patroonmaking & grafieken",
    component: () => <FiletChartMaker />,
  },
  {
    slug: "stekenbibliotheek",
    title: "Stekenbibliotheek",
    description:
      "Steken opzoeken met uitleg en symbool. Brei- en haakvarianten.",
    category: "patroon",
    categoryLabel: "Patroonmaking & grafieken",
    component: () => <Stekenbibliotheek />,
  },
  {
    slug: "projectplanner",
    title: "Projectplanner",
    description:
      "Sla garens, naalden, stekenproef en voortgang op per project.",
    category: "planning",
    categoryLabel: "Projectplanning",
    component: () => <Projectplanner />,
  },
  {
    slug: "rijenteller",
    title: "Rijenteller",
    description:
      "Klik-teller voor rijen en steken. Eventueel met doelaantal.",
    category: "planning",
    categoryLabel: "Projectplanning",
    component: () => <Rijenteller />,
  },
  {
    slug: "kostencalculator",
    title: "Kostencalculator",
    description:
      "Hoeveel kost mijn project in garen? Prijs per bol × aantal bollen.",
    category: "planning",
    categoryLabel: "Projectplanning",
    component: () => <Kostencalculator />,
  },
  {
    slug: "tijdschatting",
    title: "Tijdschatting",
    description:
      "Steken per uur × totaal steken → geschatte projectduur.",
    category: "planning",
    categoryLabel: "Projectplanning",
    component: () => <Tijdschatting />,
  },
  {
    slug: "deadline-planner",
    title: "Deadline-planner",
    description:
      "Klaar voor Kerstmis? Hoeveel rijen per dag nodig?",
    category: "planning",
    categoryLabel: "Projectplanning",
    component: () => <DeadlinePlanner />,
  },
  {
    slug: "sokkenpatroon-calculator",
    title: "Sokkenpatroon calculator",
    description:
      "Hielbreedte, neus, schacht op basis van voetmaat en gauge.",
    category: "breien",
    categoryLabel: "Breien specifiek",
    component: () => <SokkenpatroonCalculator />,
  },
  {
    slug: "truiconstructie-wizard",
    title: "Truiconstructie wizard",
    description:
      "Kies maat en gauge voor een step-by-step patroonberekening.",
    category: "breien",
    categoryLabel: "Breien specifiek",
    component: () => <TruiconstructieWizard />,
  },
  {
    slug: "raglan-berekening",
    title: "Raglan/yoke berekening",
    description:
      "Hoeveel steken vermeerderen per ronde voor raglan?",
    category: "breien",
    categoryLabel: "Breien specifiek",
    component: () => <RaglanBerekening />,
  },
  {
    slug: "afwerking-calculator",
    title: "Afwerking calculator",
    description:
      "Hoeveel steken voor i-cord, picot edge of ribboord?",
    category: "breien",
    categoryLabel: "Breien specifiek",
    component: () => <AfwerkingCalculator />,
  },
  {
    slug: "granny-square-planner",
    title: "Granny square planner",
    description:
      "Hoeveel squares en border voor een deken van X bij Y cm?",
    category: "haken",
    categoryLabel: "Haken specifiek",
    component: () => <GrannySquarePlanner />,
  },
  {
    slug: "amigurumi-scaler",
    title: "Amigurumi scaler",
    description:
      "Schaal een amigurumi op naar gewenste grootte.",
    category: "haken",
    categoryLabel: "Haken specifiek",
    component: () => <AmigurumiScaler />,
  },
  {
    slug: "cirkel-calculator",
    title: "Cirkel/ovaal calculator",
    description:
      "Steken per ronde, aangroei-schema voor een platte haakcirkel.",
    category: "haken",
    categoryLabel: "Haken specifiek",
    component: () => <CirkelCalculator />,
  },
  {
    slug: "foundation-chain",
    title: "Foundation chain calculator",
    description:
      "Hoeveel steken aanslaan voor een gewenste breedte?",
    category: "haken",
    categoryLabel: "Haken specifiek",
    component: () => <FoundationChain />,
  },
  {
    slug: "draadlengte-calculator",
    title: "Draadlengte calculator",
    description:
      "Hoeveel skeins DMC floss nodig per kleur?",
    category: "borduren",
    categoryLabel: "Borduren & naaldwerk",
    component: () => <DraadlengteCalculator />,
  },
  {
    slug: "borduurkader-advies",
    title: "Borduurkader maat advisor",
    description:
      "Advies over kadergrootte op basis van patroondimensies.",
    category: "borduren",
    categoryLabel: "Borduren & naaldwerk",
    component: () => <BorduurkaderAdvies />,
  },
  {
    slug: "stofcalculator",
    title: "Stofcalculator",
    description:
      "Bereken hoeveel meter stof je nodig hebt: stroken, naadtoeslag, snijverlies en patroonherhaling.",
    category: "naaien",
    categoryLabel: "Naaien & quilten",
    faqs: stofcalculatorDefinition.faqs,
    relatedHubHref: "/sewing",
    relatedHubLabel: "Naaien op Hobbysalon",
    component: () => (
      <FormulaCalculator
        toolSlug="stofcalculator"
        title="Bereken benodigde stof"
        definition={stofcalculatorDefinition}
      />
    ),
  },
  {
    slug: "quiltcalculator",
    title: "Quiltcalculator",
    description:
      "Bereken aantal blokken, blokstof, backing en binding voor je quilt.",
    category: "naaien",
    categoryLabel: "Naaien & quilten",
    faqs: quiltcalculatorDefinition.faqs,
    relatedHubHref: "/sewing",
    relatedHubLabel: "Naaien op Hobbysalon",
    component: () => (
      <FormulaCalculator
        toolSlug="quiltcalculator"
        title="Bereken je quilt"
        definition={quiltcalculatorDefinition}
      />
    ),
  },
  {
    slug: "kaarsen-wascalculator",
    title: "Kaarsen wascalculator",
    description:
      "Bereken wasgewicht en geurolie op basis van volume, vulfactor en dichtheid.",
    category: "kaarsen",
    categoryLabel: "Kaarsen maken",
    faqs: kaarsenWascalculatorDefinition.faqs,
    component: () => (
      <FormulaCalculator
        toolSlug="kaarsen-wascalculator"
        title="Bereken was en geurolie"
        definition={kaarsenWascalculatorDefinition}
      />
    ),
  },
  {
    slug: "resin-calculator",
    title: "Resin calculator",
    description:
      "Bereken hoeveel epoxyhars en harder je nodig hebt voor je mal, op volume of gewicht.",
    category: "hars",
    categoryLabel: "Resin & hars",
    faqs: resinCalculatorDefinition.faqs,
    component: () => (
      <FormulaCalculator
        toolSlug="resin-calculator"
        title="Bereken hars A/B"
        definition={resinCalculatorDefinition}
      />
    ),
  },
  {
    slug: "kralenarmband-calculator",
    title: "Kralenarmband calculator",
    description:
      "Bereken hoeveel kralen je nodig hebt voor een armband, inclusief sluiting en tussenstukken.",
    category: "sieraden",
    categoryLabel: "Sieraden & kralen",
    faqs: kralenarmbandCalculatorDefinition.faqs,
    relatedHubHref: "/jewelry",
    relatedHubLabel: "Sieraden op Hobbysalon",
    component: () => (
      <FormulaCalculator
        toolSlug="kralenarmband-calculator"
        title="Bereken aantal kralen"
        definition={kralenarmbandCalculatorDefinition}
      />
    ),
  },
  {
    slug: "papier-snijcalculator",
    title: "Papier snijcalculator",
    description:
      "Hoeveel rechthoeken passen op een vel? Vergelijkt beide oriëntaties voor kaarten en scrapbooking.",
    category: "papier",
    categoryLabel: "Papier & kaarten",
    faqs: papierSnijcalculatorDefinition.faqs,
    relatedHubHref: "/card-making",
    relatedHubLabel: "Kaarten maken op Hobbysalon",
    component: () => (
      <FormulaCalculator
        toolSlug="papier-snijcalculator"
        title="Snijplan voor papier"
        definition={papierSnijcalculatorDefinition}
      />
    ),
  },
  {
    slug: "workshop-break-even",
    title: "Workshop break-even calculator",
    description:
      "Bereken vanaf hoeveel deelnemers je workshop winstgevend is: vaste kosten, prijs en kosten per persoon.",
    category: "zakelijk",
    categoryLabel: "Zakelijk voor makers",
    faqs: workshopBreakEvenDefinition.faqs,
    relatedHubHref: "/voor-workshopgevers",
    relatedHubLabel: "Workshops aanbieden",
    component: () => (
      <FormulaCalculator
        toolSlug="workshop-break-even"
        title="Break-even voor je workshop"
        definition={workshopBreakEvenDefinition}
      />
    ),
  },
];

const BY_SLUG = new Map<string, ToolEntry>();
for (const t of TOOLS) {
  BY_SLUG.set(t.slug, t);
}

export function getToolBySlug(slug: string): ToolEntry | undefined {
  return BY_SLUG.get(slug);
}

export function getAllTools(): ToolEntry[] {
  return [...TOOLS];
}

/** All tools as serializable summaries (safe for client components). */
export function getToolSummaries(): ToolSummary[] {
  return TOOLS.map(toSummary);
}

/** Other tools in the same category, for "related tools" navigation. */
export function getRelatedTools(slug: string, limit = 6): ToolSummary[] {
  const current = BY_SLUG.get(slug);
  if (!current) return [];
  return TOOLS.filter(
    (t) => t.category === current.category && t.slug !== slug
  )
    .slice(0, limit)
    .map(toSummary);
}

export function getToolsByCategory(): Map<ToolCategory, ToolEntry[]> {
  const map = new Map<ToolCategory, ToolEntry[]>();
  for (const t of TOOLS) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}
