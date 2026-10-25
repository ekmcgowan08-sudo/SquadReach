import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { knownNames, namesIn, shareBlockers } from '@/lib/library-share';

describe('sharing a unit with other ministries', () => {
  it('finds full names as whole words, whatever the case or punctuation', () => {
    expect(namesIn('Pray for wyatt cole, and for Grace.', ['Wyatt Cole', 'Grace Lee'])).toEqual(['Wyatt Cole']);
    expect(namesIn('Wyatt Coleman came', ['Wyatt Cole'])).toEqual([]);
    expect(namesIn('Grace and peace', ['Grace'])).toEqual([]); // single words are too common to block on
  });

  it('blocks a unit that names someone the ministry knows', () => {
    const d = demoMinistry();
    const kid = d.roster.find((r) => r.name.includes(' '))!;
    const unit = { title: 'Identity', summary: 'Good week. ' + kid.name + ' asked great questions.', includes: ['4 screens'], span: '4 screens', theme: 'Small group' };
    expect(shareBlockers(unit, d)).toEqual([kid.name]);
    expect(shareBlockers({ ...unit, summary: 'Good week. Lots of questions.' }, d)).toEqual([]);
    expect(knownNames(d).length).toBeGreaterThan(d.roster.length - 1);
  });
});
