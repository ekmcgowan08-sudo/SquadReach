import { describe, expect, it } from 'vitest';
import { checkInNames, gradeOf, importPreview, matchRoster, peopleFrom, studentsOnly } from '@/lib/pco';

const person = (id: string, first: string, last: string, grade: number | null, extra: Record<string, unknown> = {}) => ({ id, type: 'Person', attributes: { first_name: first, last_name: last, grade, child: grade !== null, status: 'active', ...extra } });

describe('Planning Center people', () => {
  it('maps grades the way Planning Center stores them', () => {
    expect([gradeOf(-1), gradeOf(0), gradeOf(7), gradeOf(12), gradeOf(13), gradeOf(null), gradeOf('9')]).toEqual(['PK', 'K', '7', '12', '12', '', '']);
  });

  it('reads a page of people into names and grades', () => {
    const doc = { data: [person('1', 'Ellison', 'Reid', 8), person('2', 'Ava', ' Lin ', null, { child: false }), { id: 'h1', type: 'Household', attributes: {} }] };
    expect(peopleFrom(doc as never)).toEqual([
      { id: '1', name: 'Ellison Reid', grade: '8', child: true, active: true },
      { id: '2', name: 'Ava Lin', grade: '', child: false, active: true }
    ]);
  });

  it('keeps active students in the grades the ministry serves', () => {
    const people = peopleFrom({ data: [person('1', 'A', 'Five', 5), person('2', 'B', 'Six', 6), person('3', 'C', 'Twelve', 12), person('4', 'D', 'Gone', 9, { status: 'inactive' }), person('5', 'E', 'Adult', null)] } as never);
    expect(studentsOnly(people).map((p) => p.name)).toEqual(['B Six', 'C Twelve']);
  });

  it('previews an import without anyone already on the roster, or anyone twice', () => {
    const people = peopleFrom({ data: [person('1', 'Ellison', 'Reid', 8), person('2', 'New', 'Kid', 7), person('3', 'new', 'kid', 7)] } as never);
    const out = importPreview(people, [{ name: 'ellison reid' }]);
    expect(out.already).toEqual(['Ellison Reid']);
    expect(out.add.map((s) => [s.name, s.grade, s.team])).toEqual([['New Kid', '7', null]]);
  });
});

describe('Planning Center check-ins', () => {
  it('counts students and guests, not volunteers, once each', () => {
    const doc = {
      data: [
        { id: '1', type: 'CheckIn', attributes: { first_name: 'Ellison', last_name: 'Reid', kind: 'Regular' } },
        { id: '2', type: 'CheckIn', attributes: { first_name: 'Sam', last_name: 'Ortiz', kind: 'Guest' } },
        { id: '3', type: 'CheckIn', attributes: { first_name: 'Coach', last_name: 'Kyle', kind: 'Volunteer' } },
        { id: '4', type: 'CheckIn', attributes: { first_name: 'Ellison', last_name: 'Reid', kind: 'Regular' } }
      ]
    };
    expect(checkInNames(doc as never)).toEqual(['Ellison Reid', 'Sam Ortiz']);
  });

  it('matches check-ins to the roster by full name', () => {
    expect(matchRoster(['ellison  reid', 'Sam Ortiz'], [{ name: 'Ellison Reid' }, { name: 'Isaac Smith' }])).toEqual({ matched: ['Ellison Reid'], unknown: ['Sam Ortiz'] });
  });
});
