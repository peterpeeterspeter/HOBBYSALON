import { ArrowUpTray } from '@medusajs/icons';

export type MercurConnectItemConfig = {
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode | string;
  provider: string;
  /** Internal vendor-panel path when the integration is available */
  href?: string;
  /** CTA label when href is set (defaults to "Open") */
  actionLabel?: string;
};

export const mercurConnectItems: MercurConnectItemConfig[] = [
  {
    name: 'Producten importeren',
    description:
      'Zet snel veel producten online met een CSV- of Excel-bestand.',
    enabled: true,
    icon: <ArrowUpTray />,
    provider: 'csv',
    href: '/products/import',
    actionLabel: 'Import CSV',
  },
  {
    name: 'Shopify Connector',
    description:
      'Koppel je Shopify-winkel: producten, voorraad, prijzen en bestellingen blijven gelijk.',
    enabled: false,
    icon: 'https://www.citypng.com/public/uploads/preview/shopify-bag-icon-symbol-logo-701751695132537nenecmhs0u.png',
    provider: 'shopify',
  },
];
