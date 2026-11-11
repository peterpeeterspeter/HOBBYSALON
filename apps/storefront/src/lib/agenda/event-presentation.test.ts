import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventDateParts, eventDisplayTimeZone, eventPriceLabel } from './event-presentation.ts';
test('new winter event renders Amsterdam source hours from true UTC instant', () => {
 assert.equal(formatEventDateParts('new','2026-11-08T10:00:00Z','2026-11-08T16:00:00Z').timeLabel, '11:00 – 17:00');
});
test('new summer event uses DST', () => {
 assert.equal(formatEventDateParts('new','2027-06-19T08:00:00Z','2027-06-19T15:00:00Z').timeLabel, '10:00 – 17:00');
});
test('local midnight determines date and multi-day grouping', () => {
 const a = formatEventDateParts('new','2026-11-26T15:00:00Z','2026-11-26T23:00:00Z');
 assert.equal(a.timeLabel,'16:00 – 00:00'); assert.equal(a.isMultiDay,true);
});
test('unaudited legacy IDs keep existing UTC display until source audit', () => {
 const id='89da4250-c9d2-40e0-a810-385217738cf2';
 assert.equal(eventDisplayTimeZone(id),'UTC');
 assert.equal(formatEventDateParts(id,'2026-12-13T10:00:00Z','2026-12-13T18:00:00Z').timeLabel,'10:00 – 18:00');
});
test('unknown admission is not free, exact zero is free', () => {
 assert.equal(eventPriceLabel(null),'Entree niet vermeld');assert.equal(eventPriceLabel(undefined),'Entree niet vermeld');
 assert.equal(eventPriceLabel(0),'Gratis toegang');assert.equal(eventPriceLabel(850),'€8.50');
});
