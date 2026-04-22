import { buildSimplePdf } from './simple-pdf';

describe('buildSimplePdf', () => {
  it('creates a valid PDF header and footer for single-page content', () => {
    const pdf = buildSimplePdf([[
      'Financial Report',
      'Period: 2026-04-01 to 2026-04-22',
      'Summary: ok',
    ]]);

    const content = pdf.toString('utf8');

    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('Financial Report');
    expect(content).toContain('startxref');
    expect(content.trim().endsWith('%%EOF')).toBe(true);
  });

  it('creates more than one page when multiple pages are passed', () => {
    const pdf = buildSimplePdf([
      ['Page 1'],
      ['Page 2'],
    ]);

    const content = pdf.toString('utf8');
    expect(content).toContain('/Count 2');
  });
});
