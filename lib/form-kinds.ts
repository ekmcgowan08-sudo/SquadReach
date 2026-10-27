/* The kinds of form a ministry sends home, and which of them hold a student
   off a trip until signed (lib/forms.ts has the rules that use this). */
import type { FormKind, PermissionSlip } from '@/lib/types/model';

export const FORM_KINDS: { id: FormKind; label: string; blocks: boolean }[] = [
  { id: 'medical', label: 'Medical & allergies', blocks: true },
  { id: 'emergency', label: 'Emergency contact', blocks: true },
  { id: 'permission', label: 'General permission', blocks: true },
  { id: 'waiver', label: 'Trip waiver', blocks: true },
  { id: 'photo', label: 'Photo release', blocks: false }
];

export const formKind = (s: Pick<PermissionSlip, 'kind'>) => FORM_KINDS.find((k) => k.id === (s.kind ?? 'permission')) ?? FORM_KINDS[2];
