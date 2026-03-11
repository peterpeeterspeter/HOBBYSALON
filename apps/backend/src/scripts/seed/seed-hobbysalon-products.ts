import { ProductStatus } from '@medusajs/framework/utils'

/**
 * Hobbysalon products for platform seed alignment.
 * Handles must match platform product slugs for linking.
 */
/** product_type must match HOBBYSALON_PRODUCT_TYPES: supply | handmade */
export const hobbysalonProductsToInsert = [
  {
    title: 'Handgehaakte sjaal',
    handle: 'handmade-crochet-scarf',
    product_type: 'handmade',
    description: 'Warme wollen sjaal in naturel, handgemaakt met liefde.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Size', values: ['One Size'] }],
    variants: [
      {
        title: 'One Size',
        allow_backorder: false,
        manage_inventory: true,
        options: { Size: 'One Size' },
        prices: [{ amount: 3499, currency_code: 'eur' }]
      }
    ]
  },
  {
    title: 'Wolpakket beginners',
    handle: 'supply-yarn-bundle',
    product_type: 'supply',
    description: 'Alles-in-één pakket om te starten met haken: wol, haaknaald en patroon.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Type', values: ['Standaard'] }],
    variants: [
      {
        title: 'Standaard',
        allow_backorder: false,
        manage_inventory: true,
        options: { Type: 'Standaard' },
        prices: [{ amount: 2499, currency_code: 'eur' }]
      }
    ]
  },
  {
    title: 'Gebreide muts',
    handle: 'handmade-knitted-hat',
    product_type: 'handmade',
    description: 'Zachte muts in merinoswol, ideaal voor de koudere maanden.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Size', values: ['One Size'] }],
    variants: [
      {
        title: 'One Size',
        allow_backorder: false,
        manage_inventory: true,
        options: { Size: 'One Size' },
        prices: [{ amount: 2999, currency_code: 'eur' }]
      }
    ]
  },
  {
    title: 'Haakpatroon: Kleine beer',
    handle: 'supply-pattern-pdf',
    product_type: 'supply',
    description: 'PDF patroon voor een amigurumi beertje. Geschikt voor beginners.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Format', values: ['PDF'] }],
    variants: [
      {
        title: 'PDF',
        allow_backorder: true,
        manage_inventory: false,
        options: { Format: 'PDF' },
        prices: [{ amount: 499, currency_code: 'eur' }]
      }
    ]
  },
  {
    title: 'Handgemaakte keramiek mok',
    handle: 'handmade-pottery-mug',
    product_type: 'handmade',
    description: 'Unieke steengoed mok, handvormig en geglazuurd.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Size', values: ['Standard'] }],
    variants: [
      {
        title: 'Standard',
        allow_backorder: false,
        manage_inventory: true,
        options: { Size: 'Standard' },
        prices: [{ amount: 2499, currency_code: 'eur' }]
      }
    ]
  },
  {
    title: 'Kralenpakket startset',
    handle: 'supply-bead-kit',
    product_type: 'supply',
    description: 'Kralen, draad en gespen om te starten met sieraden maken.',
    is_giftcard: false,
    status: ProductStatus.PUBLISHED,
    discountable: true,
    options: [{ title: 'Type', values: ['Basis'] }],
    variants: [
      {
        title: 'Basis',
        allow_backorder: false,
        manage_inventory: true,
        options: { Type: 'Basis' },
        prices: [{ amount: 1299, currency_code: 'eur' }]
      }
    ]
  }
]
