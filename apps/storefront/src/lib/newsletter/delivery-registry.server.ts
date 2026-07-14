import "server-only";
import { resolveDeliveryAsset, type DeliveryAsset } from "./delivery-asset-resolution";

const deliveryAssetRegistry: Readonly<Record<string, DeliveryAsset>> = {
  "haak-startpakket-v1": {
    assetPath: "src/lib/newsletter/assets/haken-startgids-v1.pdf",
    filename: "hobbysalon-startgids-haken.pdf",
  },
};

export function getRegisteredDeliveryAsset(code: string): DeliveryAsset | null {
  return resolveDeliveryAsset(deliveryAssetRegistry, code);
}
