# Inspiratie listing QA

Trust on `/artikelen` (nav: Inspiratie → Artikelen & tutorials) depends on real result photos and honest titles more than on filter polish.

## Release gate: featured photo

Do **not** ship a large editorial feature with:

- [ ] Missing `featured_image_url`
- [ ] Generic craft stock / landing placeholder (`/landing/placeholder-article.jpg`)
- [ ] Product packshot that does not show the finished make

The hub code skips unusable images (next suitable article, or compact text feature). Still fix CMS photos for top `is_featured` picks.

## Titles

- [ ] Shorten long SEO strings in **`title`**; keep the long form in **`seo_title`**
- [ ] Display helper only strips `| Hobbysalon` / `- Hobbysalon` — it does not rewrite prose
- [ ] `line-clamp-2` is a CSS safety net, not editorial shortening

## Editorial picks

- [ ] Mark true editorial highlights with **`is_featured`**
- [ ] Featured label is **Uitgelicht** only when that flag wins; otherwise **Nieuw om te lezen**

## Scope (96-record cap)

`listPublishedContentArticles` returns at most the newest **96** published non-pattern articles. Chips and client filters apply only to that set.

- [ ] Hub copy frames this as **recente inspiratie**, not a full archive
- [ ] **Follow-up:** server-side filtering + pagination for the full archive

## Multi-domain

- [ ] Primary `domain_id` plus `article_domains` links appear in hobby chips
- [ ] Enrichment goes through `listArticleDomainLinks` (batched public SELECT)

## Done when

First viewport: compact hero → filters → featured with a real make photo (or compact text) → count including featured → grid cards with type, hobby, level, reading time.
