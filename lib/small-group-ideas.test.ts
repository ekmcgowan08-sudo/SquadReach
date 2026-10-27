import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE, IDEA_BANK, cleanImage, ideasFor, pictureOf, screenFrom, searchPictures } from '@/lib/small-group-ideas';

describe('the idea bank', () => {
  it('has ideas for every kind of screen a leader can add', () => {
    for (const t of ['thought', 'scripture', 'game', 'pass', 'poll', 'checklist', 'video', 'spinner', 'timer', 'prayer', 'wyr']) expect(ideasFor(t).length, t).toBeGreaterThan(0);
    expect(ideasFor('nope')).toEqual([]);
  });

  it('fills a new screen from an idea without sharing its lists', () => {
    const idea = IDEA_BANK.poll[0];
    const sc = screenFrom('poll', 'x1', idea);
    expect(sc).toMatchObject({ id: 'x1', type: 'poll', title: 'Quick vote', options: idea.options });
    sc.options!.push('Something else');
    expect(IDEA_BANK.poll[0].options).not.toContain('Something else');
  });

  it('starts a blank countdown at two minutes', () => {
    expect(screenFrom('timer', 'x2')).toEqual({ id: 'x2', type: 'timer', title: '', body: '', timerSeconds: 120 });
    expect(screenFrom('timer', 'x3', IDEA_BANK.timer[1]).timerSeconds).toBe(60);
  });
});

describe('the picture bank', () => {
  it('matches every typed word against the label or a tag', () => {
    expect(searchPictures('').length).toBeGreaterThan(5);
    expect(searchPictures('sports').map((p) => p.id)).toEqual(['ministry-huddle', 'basketball-court', 'locker-room']);
    expect(searchPictures('team sports').map((p) => p.id)).toEqual(['ministry-huddle', 'locker-room']);
    expect(searchPictures('BIBLE').map((p) => p.id)).toEqual(['bible-open']);
    expect(searchPictures('submarine')).toEqual([]);
    expect(pictureOf('campfire')?.label).toBe('Campfire circle');
    expect(pictureOf('gone')).toBeNull();
  });

  it('keeps a saved picture inside the editor’s bounds', () => {
    expect(cleanImage({ ...DEFAULT_IMAGE, bankId: 'campfire', scale: 900, opacity: 2, posX: -5, posY: Number.NaN, layer: 'sideways' as never })).toEqual({
      src: null,
      bankId: 'campfire',
      layer: 'above',
      posX: 0,
      posY: 50,
      scale: 160,
      opacity: 20
    });
    /* A photo wins over a bank tile — one picture per screen. */
    expect(cleanImage({ ...DEFAULT_IMAGE, src: 'data:image/jpeg;base64,xx', bankId: 'campfire' }).bankId).toBeNull();
  });
});
