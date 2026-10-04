import { describe, expect, it } from 'vitest'

import { runVendorProductsImportDryRun } from './dry-run/utils'
import {
  detectDelimiter,
  isMedusaTemplateCsv,
  normalizeProductList,
  parsePrice,
} from './normalize'

describe('parsePrice', () => {
  it.each([
    ['6,95', 6.95],
    ['€ 6,95', 6.95],
    ['7,5 EUR', 7.5],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
    ['1234.5', 1234.5],
    ['12.00', 12],
    ['4.95', 4.95],
    ['0', 0],
    ['1.234', 1234],
  ])('parses %s → %s', (raw, expected) => {
    expect(parsePrice(raw)).toEqual({ ok: true, value: expected })
  })

  it('rejects negative, text and empty', () => {
    expect(parsePrice('-3')).toEqual({ ok: false, reason: 'negative' })
    expect(parsePrice('gratis')).toEqual({ ok: false, reason: 'invalid' })
    expect(parsePrice('')).toEqual({ ok: false, reason: 'empty' })
    expect(parsePrice(undefined)).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('detectDelimiter', () => {
  it('detects ; , tab', () => {
    expect(detectDelimiter('Artikel;Prijs\nA;1')).toBe(';')
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
  })
  it('ignores delimiters inside quoted headers', () => {
    expect(detectDelimiter('"Prijs, incl";Naam;Sku\n')).toBe(';')
  })
})

describe('normalizeProductList — real-world exports', () => {
  it('groups Shopify variant rows by handle into one product', () => {
    const csv = `Handle,Title,Body (HTML),Option1 Name,Option1 Value,Variant SKU,Variant Price,Image Src
merinogaren-50g,Merinogaren 50g,<p>Zacht garen</p>,Kleur,Rood,MER-R,4.95,https://x.be/r.jpg
merinogaren-50g,,,,Blauw,MER-B,4.95,
merinogaren-50g,,,,Groen,MER-G,5.25,`
    const r = normalizeProductList({ fileContent: csv })
    expect(r.errors).toEqual([])
    expect(r.products).toHaveLength(1)
    const p = r.products[0].product
    expect(p.title).toBe('Merinogaren 50g')
    expect(p.description).toBe('Zacht garen')
    expect(p.options).toEqual([{ title: 'Kleur', values: ['Rood', 'Blauw', 'Groen'] }])
    expect(p.variants.map((v: any) => [v.sku, v.prices[0].amount])).toEqual([
      ['MER-R', 4.95],
      ['MER-B', 4.95],
      ['MER-G', 5.25],
    ])
  })

  it('attaches WooCommerce variations to their variable parent; unmapped category is a warning', () => {
    const csv = `ID,Type,SKU,Name,Parent,Regular price,Categories,Attribute 1 name,Attribute 1 value(s)
101,simple,HAAK-4,Haaknaald 4mm,,"3,50","Haken > Naalden",,
102,variable,KAT,Katoen Mix,,,"Garen > Katoen",Kleur,"Wit, Zwart"
103,variation,KAT-W,Katoen Mix - Wit,id:102,"2,99",,Kleur,Wit
104,variation,KAT-Z,Katoen Mix - Zwart,id:102,"2,99",,Kleur,Zwart`
    const r = normalizeProductList({
      fileContent: csv,
      sourceCategoryDomainMap: { 'garen > katoen': 'pcat_garen' },
    })
    expect(r.errors).toEqual([])
    expect(r.products).toHaveLength(2)
    const [haak, katoen] = r.products
    expect(haak.product.variants[0].prices[0].amount).toBe(3.5)
    expect(haak.product.categories).toBeUndefined()
    expect(katoen.product.categories).toEqual([{ id: 'pcat_garen' }])
    expect(katoen.product.variants.map((v: any) => v.sku)).toEqual(['KAT-W', 'KAT-Z'])
    expect(katoen.product.options[0].title).toBe('Kleur')
    expect(r.warnings.some((w) => w.message.includes('Haken > Naalden'))).toBe(true)
    expect(r.unmapped_count).toBe(1)
  })

  it('reads Dutch Excel (; and € / thousand separators) without a delimiter hint', () => {
    const csv = `Artikel;Omschrijving;Prijs
Borduurring 20cm;Bamboe ring;€ 6,95
Stofpakket XL;Grote set;1.234,50
Schaar;Kleine schaar;7,5 EUR`
    const r = normalizeProductList({ fileContent: csv })
    expect(r.delimiter).toBe(';')
    expect(r.errors).toEqual([])
    expect(r.products.map((p) => p.product.variants[0].prices[0].amount)).toEqual([6.95, 1234.5, 7.5])
  })

  it('rejects negative, missing-title and non-numeric prices in CRM dumps', () => {
    const csv = `naam,prijs incl btw,ean
"Pakket ""Lente"" kaarten",12.00,5412345678901
,9.99,
Washi tape set,gratis,
Penselen set,-3,`
    const r = normalizeProductList({ fileContent: csv })
    expect(r.products.map((p) => p.product.title)).toEqual(['Pakket "Lente" kaarten'])
    expect(r.products[0].product.variants[0].ean).toBe('5412345678901')
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([
      [3, 'title'],
      [4, 'price_amount'],
      [5, 'price_amount'],
    ])
    expect(r.error_rows).toBe(3)
  })

  it('recognises Dutch headers without a mapping', () => {
    const r = normalizeProductList({ fileContent: `Productnaam,Verkoopprijs\nVilt rood,"2,10"` })
    expect(r.errors).toEqual([])
    expect(r.products[0].product.title).toBe('Vilt rood')
    expect(r.products[0].product.variants[0].prices[0].amount).toBe(2.1)
  })

  it('explains clearly when no title column exists', () => {
    const r = normalizeProductList({ fileContent: `Foo,Bar\n1,2` })
    expect(r.products).toEqual([])
    expect(r.errors[0].message).toContain('Foo, Bar')
  })

  it('flags duplicate variant values', () => {
    const csv = `Handle,Title,Option1 Name,Option1 Value,Variant Price
a,A,Kleur,Rood,1
a,,,Rood,1`
    const r = normalizeProductList({ fileContent: csv })
    expect(r.products).toEqual([])
    expect(r.errors[0].message).toContain('Dubbele variant')
  })
})

describe('dry-run matches import (shared normalizer)', () => {
  it('produces products that pass CreateProduct validation', () => {
    const csv = `Artikel;Prijs;Kleur
Pompon;1,50;Rood`
    const d = runVendorProductsImportDryRun({ fileContent: csv })
    expect(d.error_count).toBe(0)
    expect(d.valid_count).toBe(1)
    expect(d.preview[0]).toMatchObject({ title: 'Pompon', price_amount: 1.5, variant_count: 1 })
  })

  it('respects explicit column mapping', () => {
    const d = runVendorProductsImportDryRun({
      fileContent: `Omschr,Bedrag\nLijm,3`,
      mapping: { title: 'Omschr', price_amount: 'Bedrag' },
    })
    expect(d.valid_count).toBe(1)
  })

  it('leaves the Medusa template to the native parser', () => {
    const csv = `Product Handle,Product Title,Variant Price EUR\nx,X,1`
    expect(isMedusaTemplateCsv(csv)).toBe(true)
    const d = runVendorProductsImportDryRun({ fileContent: csv })
    expect(d.warnings[0].message).toContain('Medusa')
  })
})
