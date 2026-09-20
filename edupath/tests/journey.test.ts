import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import JourneyPage, { journeyFixture } from '@/app/journey/page';

describe('SPEC-003 journey frontend', () => {
  it('renders the local journey fixture with objectives and activity actions', () => {
    const html = renderToStaticMarkup(createElement(JourneyPage, { initialJourneyData: journeyFixture }));

    expect(html).toContain('Your next missions');
    expect(html).toContain('SQL');
    expect(html).toContain('Done');
    expect(html).toContain('Skip');
  });

  it('renders multiple objectives with unique ids and distinct skill names without duplicate key collisions', () => {
    const customJourney = {
      ...journeyFixture,
      objectives: [
        {
          id: 'obj-1',
          skillId: 'skill-sql',
          skill: 'SQL',
          description: 'Master SQL fundamentals and joins.',
          criteria: ['Write queries with WHERE and JOIN.'],
          targetLevel: 2,
        },
        {
          id: 'obj-2',
          skillId: 'skill-sheets',
          skill: 'Spreadsheets',
          description: 'Master pivot tables and data summaries.',
          criteria: ['Create pivot tables.'],
          targetLevel: 2,
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(JourneyPage, { initialJourneyData: customJourney }));

    expect(html).toContain('SQL');
    expect(html).toContain('Spreadsheets');
    expect(html).toContain('Master SQL fundamentals');
    expect(html).toContain('Master pivot tables');
  });
});

