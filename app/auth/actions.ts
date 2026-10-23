'use server';
/* Onboarding writes: create a ministry, or ask to join one with an invite
   code. Both run as the signed-in user through RPCs that RLS can't be
   talked around (create_ministry makes you owner; request_access refuses
   owner and lands in a leader's queue). */
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export interface FormState {
  error?: string;
  done?: string;
}

export async function createMinistry(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('ministry') ?? '').trim();
  const me = String(form.get('name') ?? '').trim();
  if (name.length < 3) return { error: 'Give the ministry a name people will recognise.' };
  if (!me) return { error: 'Add your name — it shows on everything you post.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('create_ministry', { p_name: name, p_display_name: me });
  if (error) return { error: error.message };
  redirect('/dashboard');
}

export async function requestToJoin(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get('code') ?? '').trim().toUpperCase();
  const me = String(form.get('name') ?? '').trim();
  const role = String(form.get('role') ?? 'member');
  const note = String(form.get('note') ?? '').trim();
  if (!code) return { error: 'Enter the invite code your ministry shared.' };
  if (!me) return { error: 'Add your name so a leader knows who is asking.' };
  if (!['member', 'captain', 'coach', 'scorekeeper', 'leader'].includes(role)) return { error: 'Pick what you do in the ministry.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('request_access', { p_code: code, p_role: role, p_name: me, p_note: note });
  if (error) return { error: error.message.includes('no ministry') ? 'No ministry has that code — check it with whoever sent it.' : error.message };
  return { done: 'Sent. A leader approves you, and then this page opens the app.' };
}
