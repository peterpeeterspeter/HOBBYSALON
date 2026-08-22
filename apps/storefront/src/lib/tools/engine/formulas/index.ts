import type { FormulaFn, FormulaId } from "../types";
import { fabricFormula } from "./fabric";
import { quiltFormula } from "./quilt";
import { candleFormula } from "./candle";
import { resinFormula } from "./resin";
import { beadsFormula } from "./beads";
import { paperFormula } from "./paper";
import { workshopBreakevenFormula } from "./workshop-breakeven";

export const FORMULAS: Record<FormulaId, FormulaFn> = {
  fabric: fabricFormula,
  quilt: quiltFormula,
  candle: candleFormula,
  resin: resinFormula,
  beads: beadsFormula,
  paper: paperFormula,
  workshop_breakeven: workshopBreakevenFormula,
};
