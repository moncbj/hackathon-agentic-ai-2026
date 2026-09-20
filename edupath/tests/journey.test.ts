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
});
