# Shared product catalog BE/NL (Changeset C)

## Business rule

All Hobbysalon marketplace products are offered to customers in both Belgium and the Netherlands.

## Approach

- One shared platform product catalog on `.be` and `.nl`.
- Homepage product rails and materials listings show the same published products on both domains.
- Pricing, inventory, contact-only flows, and checkout stay unchanged.
- Medusa validates shipping methods and costs at checkout when the buyer enters an address.

## Explicitly out of scope

- No country-specific product availability service
- No batch availability endpoints
- No variant-country logic
- No database migrations or `sales_country_codes`

## Changeset E (unchanged)

VAT nuances, payment-method presentation, and sellers without shipping options remain checkout concerns, not discovery filters.
