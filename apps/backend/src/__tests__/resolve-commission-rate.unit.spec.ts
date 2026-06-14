import {
  calculatePercentageCommissionAmount,
  getCommissionCalculationBase,
  resolveHobbysalonCommissionPercentage,
} from "../../../../packages/modules/commission/src/modules/commission/resolve-commission-rate";

describe("resolveHobbysalonCommissionPercentage", () => {
  it("returns 6% for handmade", () => {
    expect(resolveHobbysalonCommissionPercentage({ productTypeValue: "handmade" })).toBe(
      0.06
    );
  });

  it("returns 10% for supply", () => {
    expect(resolveHobbysalonCommissionPercentage({ productTypeValue: "supply" })).toBe(
      0.1
    );
  });

  it("returns 10% for workshop_kit by supplier/merchant seller", () => {
    expect(
      resolveHobbysalonCommissionPercentage({
        productTypeValue: "workshop_kit",
        sellerType: "merchant",
      })
    ).toBe(0.1);
  });

  it("returns 6% for workshop_kit by maker/creator seller", () => {
    expect(
      resolveHobbysalonCommissionPercentage({
        productTypeValue: "workshop_kit",
        sellerType: "creator",
      })
    ).toBe(0.06);
  });

  it("excludes shipping from commission base when include_tax is false", () => {
    const base = getCommissionCalculationBase({
      itemTotal: 1200,
      itemTaxTotal: 200,
      includeTax: false,
    });
    expect(base).toBe(1000);
    expect(calculatePercentageCommissionAmount({ base, percentageRate: 6 })).toBe(60);
  });
});
