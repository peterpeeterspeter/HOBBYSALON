import { NextResponse } from "next/server";
import { listMaterialsCatalog } from "@/lib/platform/queries/products";
import { publicAssetUrl } from "@/lib/media/public-asset-url";

export const dynamic = "force-dynamic";

/**
 * Lightweight materials suggestions for calculator "Wat heb je nodig?" slots.
 * GET /api/tools/materials?q=stof&limit=6
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(12, Math.max(1, Math.floor(limitRaw)))
    : 6;

  if (!q || q.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const { products } = await listMaterialsCatalog({
      q,
      catalog_scope: "merchant",
      limit,
      offset: 0,
    });

    const slim = products.slice(0, limit).map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      featured_image_url: publicAssetUrl(product.featured_image_url),
      creator_display_name: product.creator_display_name,
      offer_badge: product.offer.badge,
      display_price: product.displayPrice
        ? {
            amount: product.displayPrice.amount,
            currency_code: product.displayPrice.currency_code,
          }
        : null,
    }));

    return NextResponse.json({ products: slim });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
