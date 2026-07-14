export type DeliveryAsset = {
  assetPath: string;
  filename: string;
};

export function resolveDeliveryAsset(
  registry: Readonly<Record<string, DeliveryAsset>>,
  code: string
): DeliveryAsset | null {
  return Object.prototype.hasOwnProperty.call(registry, code) ? registry[code] : null;
}
