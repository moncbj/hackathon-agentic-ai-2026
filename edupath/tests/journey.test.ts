import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import JourneyPage, { journeyFixture } from '@/app/journey/page';

describe('SPEC-003 journey frontend', () => {
  it('renders the local journey fixture with objectives and activity actions', () => {
    const html = renderToStaticMarkup(createElement(JourneyPage, { initialJourneyData: journeyFixture }));

    expect(html).toContain('Biology foundations');
    expect(html).toContain('Cell Membranes');
    expect(html).toContain('Up next for you!');
    expect(html).toContain('Course Challenge');
  });
});
