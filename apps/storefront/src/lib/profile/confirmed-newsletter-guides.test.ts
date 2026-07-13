import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getConfirmedNewsletterGuides } from './confirmed-newsletter-guides.ts';

test('keeps only confirmed rows for active, well-formed newsletter guides and removes duplicates', () => {
  const guides = getConfirmedNewsletterGuides([
    {
      email: '  LIES@example.be ',
      status: 'confirmed',
      lead_magnet: {
        id: 'lead-1',
        code: 'haken-startgids',
        title: 'Startgids haken',
        is_active: true
      }
    },
    {
      email: 'lies@example.be',
      status: 'pending',
      lead_magnet: {
        id: 'lead-2',
        code: 'breien-startgids',
        title: 'Startgids breien',
        is_active: true
      }
    },
    {
      email: 'lies@example.be',
      status: 'confirmed',
      lead_magnet: {
        id: 'lead-3',
        code: 'inactief',
        title: 'Verborgen gids',
        is_active: false
      }
    },
    {
      email: 'lies@example.be',
      status: 'confirmed',
      lead_magnet: {
        id: 'lead-1',
        code: 'haken-startgids',
        title: 'Startgids haken',
        is_active: true
      }
    },
    {
      email: 'lies@example.be',
      status: 'confirmed',
      lead_magnet: {
        id: 'lead-4',
        code: 'zonder-titel',
        title: '',
        is_active: true
      }
    }
  ]);

  assert.deepEqual(guides, [
    {
      id: 'lead-1',
      code: 'haken-startgids',
      title: 'Startgids haken'
    }
  ]);
});
