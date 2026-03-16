/**
 * Extended Hobbysalon seed: extra creators, products, workshops, events.
 * Run: npx tsx scripts/seed-extended.ts
 * Requires: PEXELS_API_KEY (optional for images), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Prerequisite: scripts/seed-platform.sql must be run first
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load env: .env.local (storefront), .env (root), then process.env
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), "..", "..", ".env") });
dotenv.config({ path: path.join(process.cwd(), "..", "..", ".env.local") });
dotenv.config();

const PEXELS_API = "https://api.pexels.com/v1";
const DOMAIN = {
  crochet: "d1111111-1111-1111-1111-111111111101",
  knitting: "d1111111-1111-1111-1111-111111111102",
  cardMaking: "d1111111-1111-1111-1111-111111111103",
  sewing: "d1111111-1111-1111-1111-111111111104",
  jewelry: "d1111111-1111-1111-1111-111111111105",
  scrapbooking: "d1111111-1111-1111-1111-111111111106",
  pottery: "d1111111-1111-1111-1111-111111111107",
  diy: "d1111111-1111-1111-1111-111111111108",
};

type PexelsPhoto = {
  id: number;
  src: { original: string; large2x: string; large: string; landscape: string };
};
type PexelsResp = { photos: PexelsPhoto[] };

async function searchPexels(
  query: string,
  orientation: "square" | "landscape" = "square"
): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    query,
    orientation,
    per_page: "1",
  });
  const res = await fetch(`${PEXELS_API}/search?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as PexelsResp;
  return data.photos[0] ?? null;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) required"
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const force = process.argv.includes("--force");
  const productsDir = path.join(process.cwd(), "public", "landing", "products");
  fs.mkdirSync(productsDir, { recursive: true });

  // --- CREATORS (Etsy-style makers + suppliers) ---
  const CREATOR_IDS = {
    c201: "c2222222-2222-2222-2222-222222222201",
    c202: "c2222222-2222-2222-2222-222222222202",
    c203: "c2222222-2222-2222-2222-222222222203",
    c204: "c2222222-2222-2222-2222-222222222204",
    c205: "c2222222-2222-2222-2222-222222222205",
    c206: "c2222222-2222-2222-2222-222222222206",
    c207: "c2222222-2222-2222-2222-222222222207",
    c208: "c2222222-2222-2222-2222-222222222208",
    c209: "c2222222-2222-2222-2222-222222222209",
    c210: "c2222222-2222-2222-2222-222222222210",
    c211: "c2222222-2222-2222-2222-222222222211",
    c212: "c2222222-2222-2222-2222-222222222212",
  } as const;
  const creators: Array<{
    id: string;
    slug: string;
    display_name: string;
    business_name: string;
    bio: string;
    types: readonly ("maker" | "supplier" | "workshopgever")[];
    domain: string;
  }> = [
    {
      id: CREATOR_IDS.c204,
      slug: "luna-studio",
      display_name: "Luna Vandenberghe",
      business_name: "Luna Studio",
      bio: "Keramiek en slow design. Unieke stukken met oog voor detail.",
      types: ["maker"],
      domain: DOMAIN.pottery,
    },
    {
      id: CREATOR_IDS.c205,
      slug: "stoffenschat",
      display_name: "Sophie Vermeersch",
      business_name: "Stoffenschat",
      bio: "Kwaliteitsstoffen en naai-accessoires voor elk project.",
      types: ["supplier"],
      domain: DOMAIN.sewing,
    },
    {
      id: CREATOR_IDS.c206,
      slug: "papier-atelier",
      display_name: "Emma Dekker",
      business_name: "Papier Atelier",
      bio: "Handgemaakte kaarten en scrapbooking materialen.",
      types: ["maker", "supplier"],
      domain: DOMAIN.cardMaking,
    },
    {
      id: CREATOR_IDS.c207,
      slug: "goud-smid",
      display_name: "Thomas Janssens",
      business_name: "Goud & Zilver",
      bio: "Sieradenmaker en workshopgever. Traditionele ambachten.",
      types: ["maker", "workshopgever"],
      domain: DOMAIN.jewelry,
    },
    {
      id: CREATOR_IDS.c208,
      slug: "brei-atelier",
      display_name: "Ingrid Peeters",
      business_name: "Brei-atelier Ingrid",
      bio: "Gebreide mode en breiles. Van beginner tot gevorderd.",
      types: ["maker", "workshopgever"],
      domain: DOMAIN.knitting,
    },
    {
      id: CREATOR_IDS.c209,
      slug: "craft-corner",
      display_name: "Craft Corner",
      business_name: "Craft Corner",
      bio: "Hobbymaterialen en DIY-supplies. Voor elk creatief project.",
      types: ["supplier"],
      domain: DOMAIN.diy,
    },
    {
      id: CREATOR_IDS.c210,
      slug: "atelier-rood",
      display_name: "Lisa De Bruyne",
      business_name: "Atelier Rood",
      bio: "Handgemaakte sieraden en kralenworkshops.",
      types: ["maker", "workshopgever"],
      domain: DOMAIN.jewelry,
    },
    {
      id: CREATOR_IDS.c211,
      slug: "haak-parel",
      display_name: "Mieke Willems",
      business_name: "Haakparel",
      bio: "Amigurumi en haakpatronen. Mijn ontwerpen zijn beginner-vriendelijk.",
      types: ["maker"],
      domain: DOMAIN.crochet,
    },
    {
      id: CREATOR_IDS.c212,
      slug: "klei-werk",
      display_name: "Jan & Mie",
      business_name: "Kleiwerek",
      bio: "Keramiekatelier en draaicursussen. Samen creatief.",
      types: ["maker", "workshopgever"],
      domain: DOMAIN.pottery,
    },
  ];

  for (const c of creators) {
    const { error } = await supabase.from("creators").upsert(
      {
        id: c.id,
        slug: c.slug,
        display_name: c.display_name,
        business_name: c.business_name,
        bio: c.bio,
        creator_types: c.types as unknown as string[],
        is_featured: true,
      },
      { onConflict: "id", ignoreDuplicates: !force }
    );
    if (error) console.warn("Creator", c.slug, error.message);
    const { error: cdErr } = await supabase.from("creator_domains").upsert(
      { creator_id: c.id, domain_id: c.domain, is_primary: true },
      { onConflict: "creator_id,domain_id", ignoreDuplicates: !force }
    );
    if (cdErr) console.warn("Creator domain", c.slug, cdErr.message);
  }
  console.log("✓ Creators");

  // --- PRODUCT CATEGORIES ---
  const CAT_IDS = {
    stoffen: "33333333-3333-3333-3333-333333333304",
    stempels: "33333333-3333-3333-3333-333333333305",
    kralen: "33333333-3333-3333-3333-333333333306",
    papier: "33333333-3333-3333-3333-333333333307",
    klei: "33333333-3333-3333-3333-333333333308",
  };
  const categories = [
    { id: CAT_IDS.stoffen, domain_id: DOMAIN.sewing, slug: "stoffen", name: "Stoffen", sort_order: 1 },
    { id: CAT_IDS.stempels, domain_id: DOMAIN.cardMaking, slug: "stempels", name: "Stempels", sort_order: 1 },
    { id: CAT_IDS.kralen, domain_id: DOMAIN.jewelry, slug: "kralen", name: "Kralen", sort_order: 1 },
    { id: CAT_IDS.papier, domain_id: DOMAIN.scrapbooking, slug: "papier", name: "Papier", sort_order: 1 },
    { id: CAT_IDS.klei, domain_id: DOMAIN.pottery, slug: "klei", name: "Klei", sort_order: 2 },
  ];
  for (const cat of categories) {
    await supabase.from("product_categories").upsert(cat, {
      onConflict: "id",
      ignoreDuplicates: !force,
    });
  }
  console.log("✓ Categories");

  // --- PRODUCTS (handmade + supply) ---
  const PRODUCT_IDS = Array.from({ length: 40 }, (_, i) => {
    const hex = (i + 7).toString(16).padStart(2, "0");
    return `44444444-4444-4444-4444-4444444444${hex}`;
  });
  const products: Array<{
    id: string;
    creator_id: string;
    domain_id: string;
    category_id?: string;
    slug: string;
    title: string;
    short: string;
    type: "handmade" | "supply";
    featured?: boolean;
    pexelsQuery: string;
  }> = [
    { id: PRODUCT_IDS[0], creator_id: CREATOR_IDS.c204, domain_id: DOMAIN.pottery, slug: "handmade-keramiek-schaal", title: "Handgemaakte keramiek schaal", short: "Unieke geglazuurde schaal", type: "handmade", pexelsQuery: "ceramic bowl handmade pottery", featured: true },
    { id: PRODUCT_IDS[1], creator_id: CREATOR_IDS.c205, domain_id: DOMAIN.sewing, category_id: CAT_IDS.stoffen, slug: "stoffenbundel-basics", title: "Stoffenbundel basics", short: "5 stuks katoen in neutrale tinten", type: "supply", pexelsQuery: "fabric textiles sewing", featured: true },
    { id: PRODUCT_IDS[2], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.cardMaking, category_id: CAT_IDS.stempels, slug: "handgemaakte-verjaardagskaart", title: "Handgemaakte verjaardagskaart", short: "Unieke kaart met stempel en embellishments", type: "handmade", pexelsQuery: "handmade greeting card", featured: true },
    { id: PRODUCT_IDS[3], creator_id: CREATOR_IDS.c207, domain_id: DOMAIN.jewelry, slug: "zilveren-armband", title: "Zilveren armband", short: "Handgemaakte sterling zilver armband", type: "handmade", pexelsQuery: "silver bracelet handmade jewelry", featured: true },
    { id: PRODUCT_IDS[4], creator_id: CREATOR_IDS.c208, domain_id: DOMAIN.knitting, slug: "gebreide-deken", title: "Gebreide plaid deken", short: "Zachte merinos deken in natuurlijke tinten", type: "handmade", pexelsQuery: "knitted blanket wool", featured: true },
    { id: PRODUCT_IDS[5], creator_id: CREATOR_IDS.c209, domain_id: DOMAIN.diy, slug: "diy-starterset", title: "DIY Starterset", short: "Basisgereedschap en materialen voor creatieve projecten", type: "supply", pexelsQuery: "diy craft tools materials", featured: true },
    { id: PRODUCT_IDS[6], creator_id: CREATOR_IDS.c210, domain_id: DOMAIN.jewelry, category_id: CAT_IDS.kralen, slug: "oorbellen-handgemaakt", title: "Handgemaakte oorbellen", short: "Unieke oorhangers met kralen en metaal", type: "handmade", pexelsQuery: "handmade earrings beads" },
    { id: PRODUCT_IDS[7], creator_id: CREATOR_IDS.c211, domain_id: DOMAIN.crochet, slug: "amigurumi-kat", title: "Amigurumi speelgoedkat", short: "Schattige gehaakte kat, beginner-proof patroon", type: "handmade", pexelsQuery: "amigurumi crochet toy" },
    { id: PRODUCT_IDS[8], creator_id: CREATOR_IDS.c212, domain_id: DOMAIN.pottery, slug: "keramiek-vaas", title: "Handgemaakte keramiek vaas", short: "Unieke draaiwerk vaas in steengoed", type: "handmade", pexelsQuery: "pottery vase ceramic" },
    { id: PRODUCT_IDS[9], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.scrapbooking, category_id: CAT_IDS.papier, slug: "scrapbook-set", title: "Scrapbook starterset", short: "Papier, stickers en embellishments", type: "supply", pexelsQuery: "scrapbook paper craft" },
    { id: PRODUCT_IDS[10], creator_id: CREATOR_IDS.c205, domain_id: DOMAIN.sewing, slug: "naaimachine-accessoires", title: "Naaimachine accessoires", short: "Ritsen, knopen en garen in set", type: "supply", pexelsQuery: "sewing supplies buttons" },
    { id: PRODUCT_IDS[11], creator_id: CREATOR_IDS.c211, domain_id: DOMAIN.crochet, slug: "haakpatroon-vogel", title: "Haakpatroon: Vogel", short: "PDF patroon amigurumi vogeltje", type: "supply", pexelsQuery: "crochet pattern bird" },
    { id: PRODUCT_IDS[12], creator_id: CREATOR_IDS.c208, domain_id: DOMAIN.knitting, slug: "wolpakket-merino", title: "Merino wolpakket", short: "Premium merinoswol in zachte tinten", type: "supply", pexelsQuery: "wool yarn merino" },
    { id: PRODUCT_IDS[13], creator_id: CREATOR_IDS.c207, domain_id: DOMAIN.jewelry, slug: "zilveren-hanger", title: "Zilveren hanger", short: "Handgemaakte hanger met edelsteen", type: "handmade", pexelsQuery: "silver pendant jewelry" },
    { id: PRODUCT_IDS[14], creator_id: CREATOR_IDS.c212, domain_id: DOMAIN.pottery, category_id: CAT_IDS.klei, slug: "klei-starterset", title: "Klei starterset", short: "Klei, draad en basisgereedschap", type: "supply", pexelsQuery: "clay pottery materials" },
    // Extra producten over alle domeinen
    { id: PRODUCT_IDS[15], creator_id: CREATOR_IDS.c201, domain_id: DOMAIN.crochet, slug: "haak-deken-patroon", title: "Haakpatroon: Plaid deken", short: "Groot patroon voor een zachte deken", type: "supply", pexelsQuery: "crochet blanket pattern" },
    { id: PRODUCT_IDS[16], creator_id: CREATOR_IDS.c202, domain_id: DOMAIN.knitting, slug: "gebreide-sjaal-wol", title: "Gebreide sjaal in alpaca", short: "Zachte alpaca sjaal, handgebreid", type: "handmade", pexelsQuery: "knitted scarf wool" },
    { id: PRODUCT_IDS[17], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.cardMaking, slug: "kaart-set-5stuks", title: "Kaartenset 5 stuks", short: "5 handgemaakte kaarten in doos", type: "handmade", pexelsQuery: "greeting cards set handmade" },
    { id: PRODUCT_IDS[18], creator_id: CREATOR_IDS.c205, domain_id: DOMAIN.sewing, slug: "naaipatronen-set", title: "Naaipatronen set", short: "3 digitale patronen voor beginners", type: "supply", pexelsQuery: "sewing pattern fabric" },
    { id: PRODUCT_IDS[19], creator_id: CREATOR_IDS.c207, domain_id: DOMAIN.jewelry, slug: "kralenpakket-edelstenen", title: "Kralenpakket edelstenen", short: "Kralen van echte edelstenen", type: "supply", pexelsQuery: "gemstone beads jewelry" },
    { id: PRODUCT_IDS[20], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.scrapbooking, slug: "decoratie-set-retro", title: "Decoratie set retro", short: "Stickers, washitape en embellishments", type: "supply", pexelsQuery: "scrapbook embellishments" },
    { id: PRODUCT_IDS[21], creator_id: CREATOR_IDS.c204, domain_id: DOMAIN.pottery, slug: "keramiek-kopje", title: "Handgemaakte keramiek kopje", short: "Klein kopje met uniek glazuur", type: "handmade", pexelsQuery: "ceramic cup handmade" },
    { id: PRODUCT_IDS[22], creator_id: CREATOR_IDS.c209, domain_id: DOMAIN.diy, slug: "houtbewerking-set", title: "Houtbewerking starterset", short: "Gereedschap voor houtprojecten", type: "supply", pexelsQuery: "woodworking tools" },
    { id: PRODUCT_IDS[23], creator_id: CREATOR_IDS.c211, domain_id: DOMAIN.crochet, slug: "haak-pet", title: "Gehaakte zomerpet", short: "Ademende katoenen pet", type: "handmade", pexelsQuery: "crochet hat summer" },
    { id: PRODUCT_IDS[24], creator_id: CREATOR_IDS.c208, domain_id: DOMAIN.knitting, slug: "breipatroon-vest", title: "Breipatroon: Vest", short: "PDF patroon damesvest maat S–L", type: "supply", pexelsQuery: "knitting pattern sweater" },
    { id: PRODUCT_IDS[25], creator_id: CREATOR_IDS.c210, domain_id: DOMAIN.jewelry, slug: "armband-macrame", title: "Macramé armband", short: "Handgeknoopte armband met kralen", type: "handmade", pexelsQuery: "macrame bracelet beads" },
    { id: PRODUCT_IDS[26], creator_id: CREATOR_IDS.c212, domain_id: DOMAIN.pottery, slug: "draaischijf-cursus", title: "Draaien op schijf – pakket", short: "Klei + 2 uur instructie", type: "supply", pexelsQuery: "pottery wheel clay" },
    { id: PRODUCT_IDS[27], creator_id: CREATOR_IDS.c201, domain_id: DOMAIN.crochet, slug: "amigurumi-panda", title: "Amigurumi panda", short: "Knuffel panda, handgehaakt", type: "handmade", pexelsQuery: "amigurumi panda crochet" },
    { id: PRODUCT_IDS[28], creator_id: CREATOR_IDS.c205, domain_id: DOMAIN.sewing, slug: "patchwork-kit", title: "Patchwork startkit", short: "Stoffen en patroon voor placemat", type: "supply", pexelsQuery: "patchwork fabric quilt" },
    { id: PRODUCT_IDS[29], creator_id: CREATOR_IDS.c203, domain_id: DOMAIN.pottery, slug: "handgemaakte-theekan", title: "Handgemaakte theekan", short: "Steengoed theekan, geglazuurd", type: "handmade", pexelsQuery: "ceramic teapot handmade" },
    { id: PRODUCT_IDS[30], creator_id: CREATOR_IDS.c209, domain_id: DOMAIN.diy, slug: "verf-set-acryl", title: "Acrylverf starterset", short: "12 kleuren + penselen", type: "supply", pexelsQuery: "acrylic paint set" },
    { id: PRODUCT_IDS[31], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.cardMaking, slug: "stempel-set-letters", title: "Stempelset alfabet", short: "26 letters + cijfers in houten doos", type: "supply", pexelsQuery: "rubber stamp letters" },
    { id: PRODUCT_IDS[32], creator_id: CREATOR_IDS.c207, domain_id: DOMAIN.jewelry, slug: "oorbellen-zilver", title: "Zilveren oorringen", short: "Minimalistische sterling zilver", type: "handmade", pexelsQuery: "silver stud earrings" },
    { id: PRODUCT_IDS[33], creator_id: CREATOR_IDS.c202, domain_id: DOMAIN.knitting, slug: "wol-alpaca-natur", title: "Alpaca wol naturel", short: "100% alpaca, 200g streng", type: "supply", pexelsQuery: "alpaca yarn natural" },
    { id: PRODUCT_IDS[34], creator_id: CREATOR_IDS.c210, domain_id: DOMAIN.jewelry, slug: "ketting-gepersonaliseerd", title: "Gepersonaliseerde ketting", short: "Naam of initiaal op bestelling", type: "handmade", pexelsQuery: "personalized necklace" },
    { id: PRODUCT_IDS[35], creator_id: CREATOR_IDS.c211, domain_id: DOMAIN.crochet, slug: "haak-muts-winter", title: "Gehaakte wintermuts", short: "Wollen muts met pompom", type: "handmade", pexelsQuery: "crochet winter hat" },
    { id: PRODUCT_IDS[36], creator_id: CREATOR_IDS.c208, domain_id: DOMAIN.knitting, slug: "brei-handschoenen", title: "Gebreide wanten", short: "Zachte wollen wanten", type: "handmade", pexelsQuery: "knitted mittens wool" },
    { id: PRODUCT_IDS[37], creator_id: CREATOR_IDS.c204, domain_id: DOMAIN.pottery, slug: "keramiek-schotel", title: "Keramiek schotel", short: "Grote schotel voor fruit of brood", type: "handmade", pexelsQuery: "ceramic plate handmade" },
    { id: PRODUCT_IDS[38], creator_id: CREATOR_IDS.c209, domain_id: DOMAIN.diy, slug: "puzzel-hout-500", title: "Houten puzzel 500 stukjes", short: "Laser gesneden, premium kwaliteit", type: "handmade", pexelsQuery: "wooden puzzle craft" },
    { id: PRODUCT_IDS[39], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.scrapbooking, slug: "fotoalbum-handgemaakt", title: "Handgemaakt fotoalbum", short: "Linnen kaft, 50 pagina's", type: "handmade", pexelsQuery: "photo album handmade" },
  ];

  for (const p of products) {
    const filepath = path.join(productsDir, `${p.slug}.jpg`);
    let imageUrl: string | null = null;
    if (process.env.PEXELS_API_KEY && (!fs.existsSync(filepath) || force)) {
      const photo = await searchPexels(p.pexelsQuery);
      if (photo) {
        const src = photo.src.large2x || photo.src.large || photo.src.original;
        fs.writeFileSync(filepath, await downloadImage(src));
        imageUrl = `/landing/products/${p.slug}.jpg`;
        await new Promise((r) => setTimeout(r, 350));
      }
    } else if (fs.existsSync(filepath)) {
      imageUrl = `/landing/products/${p.slug}.jpg`;
    }
    const row = {
      id: p.id, creator_id: p.creator_id, domain_id: p.domain_id, category_id: p.category_id || null,
      slug: p.slug, title: p.title, short_description: p.short, product_type: p.type,
      status: "active", is_active: true, featured_image_url: imageUrl, is_featured: p.featured ?? false,
    };
    const { error } = await supabase.from("products").upsert(row, { onConflict: "id", ignoreDuplicates: !force });
    if (error) console.warn("Product", p.slug, error.message);
  }
  console.log("✓ Products");

  // --- WORKSHOPS ---
  const WORKSHOP_IDS = [
    "55555555-5555-5555-5555-555555555504",
    "55555555-5555-5555-5555-555555555505",
    "55555555-5555-5555-5555-555555555506",
    "55555555-5555-5555-5555-555555555507",
    "55555555-5555-5555-5555-555555555508",
    "55555555-5555-5555-5555-555555555509",
  ];
  const SESSION_IDS = [
    "66666666-6666-6666-6666-666666666604",
    "66666666-6666-6666-6666-666666666605",
    "66666666-6666-6666-6666-666666666606",
    "66666666-6666-6666-6666-666666666607",
    "66666666-6666-6666-6666-666666666608",
    "66666666-6666-6666-6666-666666666609",
  ];
  const workshops: Array<{
    id: string;
    creator_id: string;
    domain_id: string;
    slug: string;
    title: string;
    short: string;
    price: number;
    city: string;
    pexelsQuery: string;
  }> = [
    { id: WORKSHOP_IDS[0], creator_id: CREATOR_IDS.c207, domain_id: DOMAIN.jewelry, slug: "sieraden-maken-beginners", title: "Sieraden maken voor beginners", short: "Leer kralen rijgen en een eenvoudige armband maken.", price: 3500, city: "Antwerpen", pexelsQuery: "jewelry making workshop beads" },
    { id: WORKSHOP_IDS[1], creator_id: CREATOR_IDS.c208, domain_id: DOMAIN.knitting, slug: "breien-voor-starters", title: "Breien voor starters", short: "De basis: opzetten, afkanten en je eerste rechte steek.", price: 2500, city: "Gent", pexelsQuery: "knitting workshop wool" },
    { id: WORKSHOP_IDS[2], creator_id: CREATOR_IDS.c206, domain_id: DOMAIN.cardMaking, slug: "stempel-technieken", title: "Stempeltechnieken", short: "Stempelen, inkt en lay-out voor kaarten.", price: 4000, city: "Leuven", pexelsQuery: "stamp card making craft" },
    { id: WORKSHOP_IDS[3], creator_id: CREATOR_IDS.c212, domain_id: DOMAIN.pottery, slug: "handvormen-klei", title: "Handvormen met klei", short: "Zonder draaischijf: handbouw technieken.", price: 5500, city: "Mechelen", pexelsQuery: "pottery clay handbuilding" },
    { id: WORKSHOP_IDS[4], creator_id: CREATOR_IDS.c210, domain_id: DOMAIN.jewelry, slug: "oorbellen-maken", title: "Oorbellen maken", short: "Van kralen tot afgewerkte oorbellen.", price: 3000, city: "Brussel", pexelsQuery: "earrings making craft" },
    { id: WORKSHOP_IDS[5], creator_id: CREATOR_IDS.c211, domain_id: DOMAIN.crochet, slug: "amigurumi-voor-gevorderden", title: "Amigurumi voor gevorderden", short: "Complexe vormen en technieken.", price: 4500, city: "Antwerpen", pexelsQuery: "amigurumi crochet advanced" },
  ];

  for (let i = 0; i < workshops.length; i++) {
    const w = workshops[i];
    const filepath = path.join(productsDir, `workshop-${w.slug}.jpg`);
    let imageUrl: string | null = null;
    if (process.env.PEXELS_API_KEY && (!fs.existsSync(filepath) || force)) {
      const photo = await searchPexels(w.pexelsQuery, "landscape");
      if (photo) {
        const src = photo.src.landscape || photo.src.large2x || photo.src.original;
        fs.writeFileSync(filepath, await downloadImage(src));
        imageUrl = `/landing/products/workshop-${w.slug}.jpg`;
        await new Promise((r) => setTimeout(r, 350));
      }
    } else if (fs.existsSync(filepath)) {
      imageUrl = `/landing/products/workshop-${w.slug}.jpg`;
    }
    const { error } = await supabase.from("workshops").upsert(
      {
        id: w.id,
        creator_id: w.creator_id,
        domain_id: w.domain_id,
        slug: w.slug,
        title: w.title,
        short_description: w.short,
        format_type: "physical",
        difficulty_level: "beginner",
        price_cents: w.price,
        currency_code: "EUR",
        duration_minutes: 180,
        capacity: 10,
        booking_mode: "request",
        city: w.city,
        is_featured: true,
        is_active: true,
        featured_image_url: imageUrl,
      },
      { onConflict: "id", ignoreDuplicates: !force }
    );
    if (error) console.warn("Workshop", w.slug, error.message);
    const start = addDays(14);
    const end = new Date(start);
    end.setHours(end.getHours() + 3);
    const { error: sessErr } = await supabase.from("workshop_sessions").upsert(
      {
        id: SESSION_IDS[i],
        workshop_id: w.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        capacity: 10,
        remaining_spots: 8,
        booking_status: "open",
      },
      { onConflict: "id", ignoreDuplicates: !force }
    );
    if (sessErr) console.warn("Workshop session", w.slug, sessErr.message);
  }
  console.log("✓ Workshops");

  // --- EVENTS (hobbybeurzen, ambachtsmarkten) ---
  const ORGANIZER_ID = "c2222222-2222-2222-2222-222222222203";
  const EVENT_IDS = [
    "e7777777-7777-7777-7777-777777777703",
    "e7777777-7777-7777-7777-777777777704",
    "e7777777-7777-7777-7777-777777777705",
    "e7777777-7777-7777-7777-777777777706",
    "e7777777-7777-7777-7777-777777777707",
    "e7777777-7777-7777-7777-777777777708",
    "e7777777-7777-7777-7777-777777777709",
  ];
  const events: Array<{
    id: string;
    slug: string;
    title: string;
    short: string;
    type: "handmade_market" | "hobby_fair" | "pop_up" | "open_atelier" | "workshop_day";
    city: string;
    days: number;
    pexelsQuery: string;
  }> = [
    { id: EVENT_IDS[0], slug: "ambachtsmarkt-gent", title: "Ambachtsmarkt Gent", short: "Maandelijkse markt met ambachtslieden en makers.", type: "handmade_market", city: "Gent", days: 20, pexelsQuery: "craft market handmade" },
    { id: EVENT_IDS[1], slug: "hobbybeurs-brussel", title: "Hobbybeurs Brussel", short: "Grote beurs met stands, workshops en demonstraties.", type: "hobby_fair", city: "Brussel", days: 35, pexelsQuery: "fair exhibition crafts" },
    { id: EVENT_IDS[2], slug: "pop-up-maker-antwerpen", title: "Pop-up Makers Antwerpen", short: "Tijdelijk atelier en verkoop van lokale makers.", type: "pop_up", city: "Antwerpen", days: 10, pexelsQuery: "pop up shop handmade" },
    { id: EVENT_IDS[3], slug: "open-atelier-dag", title: "Open Atelier Dag", short: "Bezoek ateliers en zie makers aan het werk.", type: "open_atelier", city: "Leuven", days: 25, pexelsQuery: "artist studio workshop" },
    { id: EVENT_IDS[4], slug: "workshop-dag-mechelen", title: "Workshop Dag Mechelen", short: "Dag vol korte workshops in verschillende ambachten.", type: "workshop_day", city: "Mechelen", days: 18, pexelsQuery: "workshop day craft" },
    { id: EVENT_IDS[5], slug: "ambachtsmarkt-leuven", title: "Ambachtsmarkt Leuven", short: "Kleine gezellige markt met handgemaakte producten.", type: "handmade_market", city: "Leuven", days: 28, pexelsQuery: "craft market small" },
    { id: EVENT_IDS[6], slug: "hobbybeurs-hasselt", title: "Hobbybeurs Hasselt", short: "Regionale hobbybeurs met veel variatie.", type: "hobby_fair", city: "Hasselt", days: 42, pexelsQuery: "fair hobby exhibition" },
  ];

  for (const ev of events) {
    const start = addDays(ev.days);
    const end = new Date(start);
    end.setHours(end.getHours() + 8);
    const filepath = path.join(productsDir, `event-${ev.slug}.jpg`);
    let imageUrl: string | null = null;
    if (process.env.PEXELS_API_KEY && (!fs.existsSync(filepath) || force)) {
      const photo = await searchPexels(ev.pexelsQuery, "landscape");
      if (photo) {
        const src = photo.src.landscape || photo.src.large2x || photo.src.original;
        fs.writeFileSync(filepath, await downloadImage(src));
        imageUrl = `/landing/products/event-${ev.slug}.jpg`;
        await new Promise((r) => setTimeout(r, 350));
      }
    } else if (fs.existsSync(filepath)) {
      imageUrl = `/landing/products/event-${ev.slug}.jpg`;
    }
    const { error } = await supabase.from("events").upsert(
      {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        short_description: ev.short,
        event_type: ev.type,
        organizer_creator_id: ORGANIZER_ID,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location_name: ev.city,
        city: ev.city,
        postal_code: "2000",
        country_code: "BE",
        ticketing_mode: "none",
        is_featured: true,
        is_active: true,
        featured_image_url: imageUrl,
      },
      { onConflict: "id", ignoreDuplicates: !force }
    );
    if (error) console.warn("Event", ev.slug, error.message);
    for (const domainId of [DOMAIN.crochet, DOMAIN.pottery]) {
      const { error: edErr } = await supabase.from("event_domains").upsert(
        { event_id: ev.id, domain_id: domainId },
        { onConflict: "event_id,domain_id", ignoreDuplicates: !force }
      );
      if (edErr) console.warn("Event domain", ev.slug, edErr.message);
    }
  }
  console.log("✓ Events");

  console.log("\nDone. Photos from Pexels (https://www.pexels.com)");
}

main().catch((e) => { console.error(e); process.exit(1); });
