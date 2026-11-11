import assert from "node:assert/strict";
import test from "node:test";
import {
  matchArticleMaterialBrowseOffers,
  materialBrowseSearchTerms,
  prefilterMaterialBrowseCatalog,
} from "./article-material-browse";

const nijntjeMaterials = [
  { key: "yarn", title: "Haakgaren maat 3 in wit en blauw of rood" },
  { key: "hook", title: "Haaknaald 2,5 mm" },
  { key: "eyes", title: "Borduurgaren voor de ogen en neus" },
  { key: "fill", title: "Fiberfill" },
];

test("browse search terms cover yarn, hook, embroidery and stuffing", () => {
  const terms = materialBrowseSearchTerms(nijntjeMaterials);
  assert.ok(terms.includes("haakgaren"));
  assert.ok(terms.includes("haaknaald"));
  assert.ok(terms.includes("borduurgaren"));
  assert.ok(terms.includes("fiberfill"));
});

test("browse prefilter keeps family matches even with Dutch 'of' and 'voor'", () => {
  const candidates = [
    {
      id: "p-yarn",
      slug: "katoen-haakgaren-wit",
      title: "Katoen haakgaren wit",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "prod_yarn",
    },
    {
      id: "p-hook",
      slug: "haaknaald-25-mm",
      title: "Haaknaald 2,5 mm",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "prod_hook",
    },
    {
      id: "p-fill",
      slug: "fiberfill-vulling",
      title: "Fiberfill vulling",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "prod_fill",
    },
    {
      id: "p-paint",
      slug: "acrylverf",
      title: "Acrylverf blauw",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "prod_paint",
    },
  ];
  const kept = prefilterMaterialBrowseCatalog(nijntjeMaterials, candidates).map((row) => row.id);
  assert.deepEqual(kept.sort(), ["p-fill", "p-hook", "p-yarn"]);
});

test("browse matcher returns up to three shop options per checklist line", () => {
  const candidates = [
    {
      id: "p1",
      slug: "haakgaren-wit",
      title: "Haakgaren wit",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "m1",
    },
    {
      id: "p2",
      slug: "haakgaren-blauw",
      title: "Haakgaren blauw",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "m2",
    },
    {
      id: "p3",
      slug: "haakgaren-rood",
      title: "Haakgaren rood",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "m3",
    },
    {
      id: "p4",
      slug: "haakgaren-groen",
      title: "Haakgaren groen",
      product_type: "supply",
      is_active: true,
      status: "active",
      medusa_product_id: "m4",
    },
  ];
  const commerce = new Map(
    candidates.map((candidate) => [
      candidate.medusa_product_id,
      {
        id: candidate.medusa_product_id,
        title: candidate.title,
        variants: [
          {
            id: `var-${candidate.id}`,
            title: "Standaard",
            calculated_price: { calculated_amount: 3.5, currency_code: "eur" },
          },
        ],
      },
    ])
  );
  const yarn = matchArticleMaterialBrowseOffers(
    [{ key: "yarn", title: "Haakgaren maat 3 in wit en blauw of rood" }],
    candidates,
    commerce
  )[0];
  assert.equal(yarn.offers.length, 3);
  assert.ok(yarn.offers.some((offer) => offer.productTitle.includes("wit")));
  assert.equal(yarn.offers[0].price?.amount, 350);
});
