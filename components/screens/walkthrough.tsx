'use client';
/* WALKTHROUGH — chapters in the order a week happens, and what is still not
   set up. The screen-by-screen tour is one tap from here. */
import { useRouter } from 'next/navigation';
import { startTour } from '@/components/shell/tour';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { WalkthroughChapters } from '@/components/walkthrough-chapters';

export function WalkthroughScreen() {
  const router = useRouter();
  return (
    <Screen label="Walkthrough">
      <ScreenHeader title="Walkthrough" sub="A week, in the order it happens" back="/dashboard/more" />
      <Btn
        variant="secondary"
        className="justify-center"
        onClick={() => {
          startTour();
          router.push('/dashboard');
        }}
      >
        <Icon name="ph ph-compass" className="mr-[6px] text-[15px]" />
        Take the screen-by-screen tour
      </Btn>
      <WalkthroughChapters />
    </Screen>
  );
}

export { WalkthroughStart } from '@/components/shell/tour';
