'use client';
/* MESSAGE PARENTS — everything a family hears from the ministry, from one
   screen: a message to all families or to the ones a slip covers, permission
   slips with who has signed, tonight's pickup time, and each family's own
   private link. Parents never get an account: the link is how they see
   their own child, sign slips and read messages. */
import { useMemo, useState } from 'react';
import { PersonChip } from '@/components/cycle/bits';
import { useCycle, useNightSave } from '@/components/cycle/use-cycle';
import { Sheet } from '@/components/sheet';
import { Btn, Chip, EmptyNote, Icon, Label, Screen, ScreenHeader } from '@/components/ui';
import { audienceKids, audienceLabel, clock, newFamilyToken, newMessage, slipDueLabel, slipsView, when } from '@/lib/cycle';
import { isoDay, nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';
import type { Family, PermissionSlip } from '@/lib/types/model';

export function ParentsScreen({ bare }: { bare?: boolean } = {}) {
  const { d, m, iso, night, t, today } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const [to, setTo] = useState('all');
  const [text, setText] = useState('');
  const [whoOpen, setWhoOpen] = useState<string | null>(null);
  const [newSlip, setNewSlip] = useState(false);
  const [famQ, setFamQ] = useState('');
  const [fam, setFam] = useState<string | null>(null);
  const views = slipsView(d);
  const reach = audienceKids(d, to).length;
  const families = Object.keys(d.families).length;
  const base = t.pickup - night.pickupShift * 60_000;

  const send = (audience: string, body: string, quiet?: boolean) => {
    const msg = newMessage(d, m.displayName, audience, body, nowMs(), uid());
    if (!msg.kids.length) {
      api().say('Nobody to send that to.');
      return;
    }
    api().mutate((x) => void x.parentMsgs.unshift(msg));
    api().emit({ kind: 'parentMsg', msg });
    api().logActivity('Message to ' + audienceLabel(d, audience).toLowerCase() + ' (' + msg.kids.length + ' families) from ' + m.displayName);
    if (!quiet) api().say('Sent to ' + msg.kids.length + (msg.kids.length === 1 ? ' family.' : ' families.') + ' It’s on each family’s link now.');
    return msg;
  };
  const shiftPickup = (by: number) => {
    const shift = night.pickupShift + by;
    saveNight(iso, (n) => void (n.pickupShift = shift));
    api().emit({ kind: 'pickup', date: iso, shift });
  };
  const paper = (slip: string, kid: string, signed: boolean) => {
    const by = signed ? 'Paper slip · ' + m.displayName : null;
    api().mutate((x) => {
      if (by) x.slipSigned[slip + '|' + kid] = { by, at: nowMs() };
      else delete x.slipSigned[slip + '|' + kid];
    });
    api().emit({ kind: 'slipSign', slip, student: kid, by });
  };

  const famList = useMemo(() => {
    const n = famQ.trim().toLowerCase();
    return d.roster
      .filter((s) => !n || s.name.toLowerCase().includes(n) || (d.families[s.name]?.guardian ?? '').toLowerCase().includes(n))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [d.roster, d.families, famQ]);

  return (
    <Screen label="Message parents">
      {!bare ? <ScreenHeader title="Parents" sub={families + ' families · ' + d.config.ministryName} back="/dashboard/more" /> : null}

      <div className="sr-card flex flex-col gap-[10px] px-[14px] py-[13px]">
        <div className="-mx-[14px] flex gap-[6px] overflow-x-auto px-[14px]" style={{ scrollbarWidth: 'none' }}>
          <Chip label="All families" on={to === 'all'} onClick={() => setTo('all')} />
          {d.slips.map((s) => (
            <Chip key={s.id} label={s.kids === 'all' ? s.title : s.title.split(/ · | from /)[0] + ' riders'} on={to === 'slip:' + s.id} onClick={() => setTo('slip:' + s.id)} />
          ))}
        </div>
        <textarea className="input min-h-[92px] py-2 text-[13px] leading-[1.5]" placeholder="Write to families" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to families" />
        <Btn
          className="justify-center"
          disabled={!text.trim()}
          onClick={() => {
            if (send(to, text.trim())) setText('');
          }}
        >
          Send to {reach} {reach === 1 ? 'family' : 'families'}
        </Btn>
        <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">Families read it on their link, with an unread dot until they open it. Nothing is texted for you.</div>
      </div>

      <div className="flex items-baseline justify-between">
        <Label>Permission slips</Label>
        <button onClick={() => setNewSlip(true)} className="text-[11.5px] font-medium text-accent-300">
          + New slip
        </button>
      </div>
      {!views.length ? <EmptyNote>No slips out. Add one for a trip, a van ride or a retreat.</EmptyNote> : null}
      {views.map((v) => {
        const un = v.total - v.signedN;
        const open = whoOpen === v.slip.id;
        return (
          <div key={v.slip.id} className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[13px] font-medium leading-[1.3] text-neutral-100">{v.slip.title}</span>
              <span className="tabular text-[11px] text-neutral-500">
                {v.signedN} of {v.total}
              </span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-neutral-900">
              <div className="h-full rounded-full bg-accent-500" style={{ width: (v.total ? (v.signedN / v.total) * 100 : 0) + '%' }} />
            </div>
            <div className="text-[11px] leading-[1.45] text-neutral-500 text-pretty">
              {slipDueLabel(v.slip, today)} ·{' '}
              {un
                ? 'Waiting on ' +
                  v.kids
                    .filter((k) => !k.signed)
                    .slice(0, 4)
                    .map((k) => k.guardian || k.name)
                    .join(', ') +
                  (un > 4 ? ' and ' + (un - 4) + ' more' : '')
                : 'Everyone has signed.'}
            </div>
            <div className="flex gap-2">
              {un ? (
                <Btn
                  variant="secondary"
                  className="flex-1 justify-center text-[12px]"
                  onClick={() => send('unsigned:' + v.slip.id, 'Reminder: the slip for ' + v.slip.title + ' is still unsigned. ' + slipDueLabel(v.slip, today) + '. You can sign it from your family link.')}
                >
                  Nudge {un} {un === 1 ? 'family' : 'families'}
                </Btn>
              ) : null}
              <Btn variant="ghost" className="flex-1 justify-center text-[12px] text-neutral-400" onClick={() => setWhoOpen(open ? null : v.slip.id)}>
                {open ? 'Hide' : 'Who has signed'}
              </Btn>
            </div>
            {open ? (
              <div className="flex flex-col">
                {v.kids.map((k) => (
                  <div key={k.name} className="flex min-h-11 items-center gap-2 border-t border-divider py-[6px]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] text-neutral-200">{k.name}</div>
                      <div className="truncate text-[10.5px] text-neutral-500">{k.signed ? 'Signed · ' + k.by : k.guardian || 'No guardian on file'}</div>
                    </div>
                    <button onClick={() => paper(v.slip.id, k.name, !k.signed)} className="min-h-9 rounded-full border border-neutral-700 px-3 text-[11px] text-neutral-300">
                      {k.signed ? 'Undo' : 'Paper slip'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="sr-card flex items-center gap-[10px] px-[14px] py-3">
        <div className="min-w-0 flex-1">
          <Label>Pickup tonight</Label>
          <div className="tabular mt-[6px] text-[20px] font-medium leading-none text-neutral-100">{clock(t.pickup)}</div>
          <div className="mt-1 text-[10.5px] text-neutral-500">at the {d.config.cycle.pickupPlace}</div>
        </div>
        <button aria-label="Five minutes earlier" onClick={() => shiftPickup(-5)} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 text-neutral-300">
          <Icon name="ph ph-minus" className="text-[14px]" />
        </button>
        <button aria-label="Five minutes later" onClick={() => shiftPickup(5)} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 text-neutral-300">
          <Icon name="ph ph-plus" className="text-[14px]" />
        </button>
        <Btn
          className="px-4"
          disabled={t.pickup === base}
          onClick={() => send('all', 'Pickup tonight is at ' + clock(t.pickup) + ' at the ' + d.config.cycle.pickupPlace + '.')}
        >
          Tell
        </Btn>
      </div>

      <Label className="mt-1">Sent</Label>
      {!d.parentMsgs.length ? <EmptyNote>Nothing sent yet.</EmptyNote> : null}
      {d.parentMsgs.slice(0, 6).map((x) => (
        <div key={x.id} className="sr-card px-[14px] py-3">
          <div className="text-[12.5px] leading-[1.5] text-neutral-200 text-pretty">{x.text}</div>
          <div className="mt-[6px] text-[10.5px] text-neutral-500">
            {audienceLabel(d, x.to)} · {when(x.at)} · read by {x.kids.filter((k) => x.reads[k]).length} of {x.kids.length}
          </div>
        </div>
      ))}

      <Label className="mt-1">Families</Label>
      <input className="input" placeholder="Find a student or guardian" value={famQ} onChange={(e) => setFamQ(e.target.value)} aria-label="Find a family" />
      <div className="sr-card overflow-hidden">
        {famList.slice(0, famQ ? 60 : 12).map((s, i) => {
          const f = d.families[s.name];
          return (
            <button key={s.id} onClick={() => setFam(s.name)} className="flex min-h-11 w-full items-center gap-[10px] px-[14px] py-[8px] text-left sr-hover" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-neutral-100">{s.name}</div>
                <div className="truncate text-[10.5px] text-neutral-500">{f ? (f.guardian || 'Guardian not named') + (f.contact ? ' · ' + f.contact : '') : 'No family on file'}</div>
              </div>
              <Icon name="ph ph-caret-right" className="text-[12px] text-neutral-600" />
            </button>
          );
        })}
        {!famQ && famList.length > 12 ? <div className="border-t border-divider px-[14px] py-[10px] text-[11px] text-neutral-500">Search for the other {famList.length - 12}.</div> : null}
      </div>

      <FamilySheet name={fam} onClose={() => setFam(null)} />
      <NewSlipSheet open={newSlip} onClose={() => setNewSlip(false)} defaultDay={iso >= isoDay(new Date()) ? iso : isoDay(new Date())} />
    </Screen>
  );
}

function FamilySheet({ name, onClose }: { name: string | null; onClose: () => void }) {
  const d = useCycle().d;
  const api = useAppApi();
  const cur = name ? d.families[name] : undefined;
  const [g, setG] = useState<{ for: string | null; guardian: string; contact: string }>({ for: null, guardian: '', contact: '' });
  /* Re-seed the fields when a different family opens. */
  const fields = g.for === name ? g : { for: name, guardian: cur?.guardian ?? '', contact: cur?.contact ?? '' };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const save = (next: Family) => {
    if (!name) return;
    api().mutate((x) => void (x.families[name] = next));
    api().emit({ kind: 'family', student: name, family: next });
  };
  const link = cur?.token ? origin + '/f/' + cur.token : '';
  return (
    <Sheet open={!!name} onClose={onClose} label="Family">
      {name ? (
        <div className="flex flex-col gap-[10px]">
          <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{name}’s family</div>
          <input className="input" placeholder="Parent or guardian" value={fields.guardian} onChange={(e) => setG({ ...fields, guardian: e.target.value })} aria-label="Guardian" />
          <input className="input" placeholder="Phone or email" value={fields.contact} onChange={(e) => setG({ ...fields, contact: e.target.value })} aria-label="Contact" />
          <Btn
            className="justify-center"
            onClick={() => {
              save({ guardian: fields.guardian.trim(), contact: fields.contact.trim(), token: cur?.token || newFamilyToken() });
              api().say('Saved.');
            }}
          >
            Save
          </Btn>
          {link ? (
            <div className="flex flex-col gap-2 rounded-md bg-neutral-900 px-3 py-[10px]">
              <div className="text-[11px] text-neutral-500">Their private link — only this family should have it</div>
              <div className="break-all text-[12px] text-neutral-200">{link}</div>
              <div className="flex gap-2">
                <Btn
                  variant="secondary"
                  className="flex-1 justify-center text-[12px]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      api().say('Link copied.');
                    } catch {
                      api().say('Copy failed — long-press the link instead.');
                    }
                  }}
                >
                  Copy
                </Btn>
                <Btn variant="secondary" className="flex-1 justify-center text-[12px]" href={'/f/' + cur!.token}>
                  Open
                </Btn>
                <Btn
                  variant="ghost"
                  className="flex-1 justify-center text-[12px] text-neutral-400"
                  onClick={() => {
                    save({ ...cur!, token: newFamilyToken() });
                    api().say('New link made. The old one stopped working.');
                  }}
                >
                  New link
                </Btn>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-500">Saving makes their private link.</div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

function NewSlipSheet({ open, onClose, defaultDay }: { open: boolean; onClose: () => void; defaultDay: string }) {
  const { d, m } = useCycle();
  const api = useAppApi();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [who, setWho] = useState<'all' | 'pick'>('all');
  const [kids, setKids] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const create = () => {
    const slip: PermissionSlip = { id: uid(), title: title.trim(), due: (day || defaultDay) + (time ? 'T' + time : ''), kids: who === 'all' ? 'all' : kids, at: nowMs() };
    api().mutate((x) => void x.slips.unshift(slip));
    api().emit({ kind: 'slip', slip });
    api().logActivity('Permission slip out: ' + slip.title + ' · ' + m.displayName);
    api().say('Slip is out. Families sign it from their link.');
    setTitle('');
    setKids([]);
    setWho('all');
    onClose();
  };
  const n = q.trim().toLowerCase();
  return (
    <Sheet open={open} onClose={onClose} label="New permission slip">
      <div className="flex flex-col gap-[10px]">
        <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">New permission slip</div>
        <input className="input" placeholder="What it’s for — Fall retreat · Nov 13–15" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Slip title" />
        <div className="flex gap-2">
          <input className="input flex-1" type="date" value={day || defaultDay} onChange={(e) => setDay(e.target.value)} aria-label="Due date" />
          <input className="input w-[120px]" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Due time (optional)" />
        </div>
        <div className="flex gap-2">
          <Chip label="Everyone" on={who === 'all'} onClick={() => setWho('all')} />
          <Chip label={'Pick students' + (kids.length ? ' · ' + kids.length : '')} on={who === 'pick'} onClick={() => setWho('pick')} />
        </div>
        {who === 'pick' ? (
          <>
            <input className="input" placeholder="Find a student" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a student" />
            <div className="flex max-h-[180px] flex-wrap gap-[6px] overflow-y-auto">
              {d.roster
                .filter((s) => !n || s.name.toLowerCase().includes(n))
                .slice(0, 40)
                .map((s) => (
                  <PersonChip key={s.id} name={s.name} on={kids.includes(s.name)} onClick={() => setKids((k) => (k.includes(s.name) ? k.filter((x) => x !== s.name) : [...k, s.name]))} />
                ))}
            </div>
          </>
        ) : null}
        <Btn className="justify-center" disabled={!title.trim() || (who === 'pick' && !kids.length)} onClick={create}>
          Send the slip out
        </Btn>
      </div>
    </Sheet>
  );
}
