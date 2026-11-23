import { describe, expect, it } from 'vitest';
import { checkExternalLink } from './linkSafety';

describe('checkExternalLink', () => {
  it.each(['https://cke.gov.pl/', 'http://example.com/a?b=1', 'mailto:kontakt@example.com'])(
    'allows %s',
    (uri) => {
      expect(checkExternalLink(uri).safe).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'file:///etc/passwd',
    'data:text/html,<b>x</b>',
  ])('blocks %s', (uri) => {
    expect(checkExternalLink(uri)).toEqual({ safe: false, reason: 'unsupported-scheme' });
  });

  it('rejects text that is not a URL', () => {
    expect(checkExternalLink('strona 5')).toEqual({ safe: false, reason: 'invalid' });
  });
});
