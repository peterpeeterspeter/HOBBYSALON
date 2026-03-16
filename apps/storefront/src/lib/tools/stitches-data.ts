/**
 * Common knit and crochet stitches - name, symbol, brief description
 */

export type StitchEntry = {
  id: string;
  name: string;
  nameNl: string;
  symbol: string;
  category: "breien" | "haken";
  description: string;
};

export const STITCHES: StitchEntry[] = [
  { id: "rev-st", name: "Reverse Stockinette", nameNl: "Verkeerde tricot", symbol: "▬", category: "breien", description: "Achterkant van tricotsteek, bobbelige textuur." },
  { id: "st-st", name: "Stockinette", nameNl: "Tricotsteek", symbol: "V", category: "breien", description: "Recht breien op voorzijde, averecht op achterzijde." },
  { id: "garter", name: "Garter", nameNl: "Ribbelsteek", symbol: "≡", category: "breien", description: "Alle rijen recht. Rekbaar, geen krullen." },
  { id: "rib-1x1", name: "1x1 Rib", nameNl: "1x1 ribbelsteek", symbol: "|·|·", category: "breien", description: "1 recht, 1 averecht afwisselend." },
  { id: "rib-2x2", name: "2x2 Rib", nameNl: "2x2 ribbelsteek", symbol: "||··", category: "breien", description: "2 recht, 2 averecht." },
  { id: "seed", name: "Seed Stitch", nameNl: "Zaadsteek", symbol: "·V·V", category: "breien", description: "Recht en averecht afwisselend, gebobbeld." },
  { id: "moss", name: "Moss Stitch", nameNl: "Mossteek", symbol: "▭▭", category: "breien", description: "Variant op zaadsteek over 2 rijen." },
  { id: "sc", name: "Single Crochet", nameNl: "Vasten", symbol: "×", category: "haken", description: "Basis haaksteek, compact." },
  { id: "dc", name: "Double Crochet", nameNl: "Stokjes", symbol: "T", category: "haken", description: "Hogere steek dan vasten." },
  { id: "hdc", name: "Half Double", nameNl: "Halve stokjes", symbol: "⫴", category: "haken", description: "Tussen vasten en stokjes in." },
  { id: "tr", name: "Treble", nameNl: "Dubbel stokjes", symbol: "⫶", category: "haken", description: "Nog hogere steek." },
  { id: "sl-st", name: "Slip Stitch", nameNl: "Halve vaste", symbol: "◦", category: "haken", description: "Vlakke, onopvallende steek." },
  { id: "ch", name: "Chain", nameNl: "Lossen", symbol: "○", category: "haken", description: "Basis voor de meeste patronen." },
  { id: "magic-ring", name: "Magic Ring", nameNl: "Magische ring", symbol: "◎", category: "haken", description: "Start voor amigurumi, geen gat." },
  { id: "granny-cluster", name: "Granny Cluster", nameNl: "Granny cluster", symbol: "⊕", category: "haken", description: "3 stokjes in één steek." },
  { id: "fpdc", name: "Front Post DC", nameNl: "Reliëfstokje voor", symbol: "⎡", category: "haken", description: "Stokje om de steek van vorige rij." },
  { id: "bpdc", name: "Back Post DC", nameNl: "Reliëfstokje achter", symbol: "⎣", category: "haken", description: "Stokje om de steek van vorige rij." },
];
