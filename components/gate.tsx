'use client';
/* The client half of a route's gate. The server page already redirected on
   a failed check; this catches a role switch on an open screen. */
import type { ReactNode } from 'react';
import { Btn, Screen } from '@/components/ui';
import { GATES, type GateName } from '@/lib/gates';
import { useApp } from '@/lib/store/provider';

export function Gate({ allow, children }: { allow: GateName; children: ReactNode }) {
  const persona = useApp((s) => s.membership.persona);
  if (GATES[allow](persona)) return <>{children}</>;
  return (
    <Screen label="Not for this role">
      <div className="sr-card flex flex-col gap-3 px-[15px] py-[14px]">
        <div className="text-[16px] font-medium text-neutral-100">Your role does not have that view.</div>
        <div className="text-[12.5px] leading-[1.5] text-neutral-400">Switch roles from the avatar on Home, or ask the youth pastor for access.</div>
        <Btn href="/dashboard" className="justify-center">
          Back to Home
        </Btn>
      </div>
    </Screen>
  );
}
