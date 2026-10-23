'use server';
import { cookies } from 'next/headers';
import { ROLE_COOKIE, getCurrentMembership } from '@/lib/get-membership';
import { isPersona } from '@/lib/types/domain';

/** Switch which of your approved roles you are using. Refuses a role you do
 *  not hold — the role sheet asks for approval instead. */
export async function switchRole(persona: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPersona(persona)) return { ok: false, error: 'Unknown role.' };
  const res = await getCurrentMembership();
  if (res && !res.roles.includes(persona)) return { ok: false, error: 'That role needs the Youth Pastor’s approval first.' };
  const jar = await cookies();
  jar.set(ROLE_COOKIE, persona, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}
