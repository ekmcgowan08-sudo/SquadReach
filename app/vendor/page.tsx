import { notFound } from 'next/navigation';
import { VendorPricing } from '@/components/vendor/pricing';
import { loadMinistrySizes, vendorAccess } from '@/lib/server/vendor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plans & Billing', robots: { index: false, follow: false } };

/* /vendor — the founder's own admin. Pricing is vendor-only: anyone who
   isn't on VENDOR_EMAILS gets a plain 404, so the page doesn't even admit
   it exists to a ministry. */
export default async function VendorPage() {
  const access = await vendorAccess();
  if (!access) notFound();
  const ministries = access === 'vendor' ? await loadMinistrySizes() : null;
  return <VendorPricing ministries={ministries} mode={access} />;
}
