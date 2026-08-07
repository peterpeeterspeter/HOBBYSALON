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
    name: 'Product Importer',
    description:
      'Quickly add products to your store by uploading CSV files, making catalog management fast and efficient.',
    enabled: true,
    icon: <ArrowUpTray />,
    provider: 'csv',
    href: '/products/import',
    actionLabel: 'Import CSV',
  },
  {
    name: 'Shopify Connector',
    description:
      'Connect your Shopify store to seamlessly sync products, stock levels, prices, and orders in real time.',
    enabled: false,
    icon: 'https://www.citypng.com/public/uploads/preview/shopify-bag-icon-symbol-logo-701751695132537nenecmhs0u.png',
    provider: 'shopify',
  },
];
