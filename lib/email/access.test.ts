import { describe, expect, it } from 'vitest';
import { renderAccessNotice } from '@/lib/email/access';

const base = { ministry: 'Grace Community Students', name: 'Sam Ortiz', role: 'Coach', email: 'sam@example.org', note: 'I run the sound board', appUrl: 'https://app.example/console?tab=people#access-requests', to: 'pastor@example.org' };

describe('the access request email', () => {
  it('says who asked, for what, and where to decide', () => {
    const m = renderAccessNotice(base);
    expect(m.subject).toBe('Access request: Sam Ortiz (Coach) at Grace Community Students');
    expect(m.text).toContain('Sam Ortiz (sam@example.org) asked to join Grace Community Students as Coach.');
    expect(m.text).toContain('Their note: “I run the sound board”');
    expect(m.text).toContain('until a leader approves them');
    expect(m.text.endsWith('Decide in SquadRise: ' + base.appUrl)).toBe(true);
    expect(m.html).toContain('Sent to pastor@example.org');
  });

  it('trusts nothing a requester typed as HTML', () => {
    const m = renderAccessNotice({ ...base, name: '<img src=x onerror=alert(1)>', note: '<b>hi</b>' });
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(m.html).not.toContain('<b>hi</b>');
  });

  it('says so when there is no note', () => {
    expect(renderAccessNotice({ ...base, note: '', email: '' }).text).toContain('Sam Ortiz asked to join Grace Community Students as Coach.\n\nThey left no note.');
  });
});
