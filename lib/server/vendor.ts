import 'server-only';
/* The vendor admin's server side: who may open it, and the ministries it
   prices. Pricing is vendor-only — nothing here is reachable from a
   ministry's own screens or data. */
import { isSupabaseConfigured } from '@/lib/env';
import { getUser } from '@/lib/get-membership';
import { isVendorEmail } from '@/lib/pricing';
import { serviceClient } from '@/lib/server/deliveries';
import { ministrySizes, type MinistrySize } from '@/lib/vendor-sizes';

/** 'vendor' for an email on VENDOR_EMAILS; 'demo' on a demo build only when
 *  VENDOR_DEMO=1; otherwise nobody — the page is a 404, not a sign-in. */
export async function vendorAccess(): Promise<'vendor' | 'demo' | null> {
  if (!isSupabaseConfigured()) return process.env.VENDOR_DEMO === '1' ? 'demo' : null;
  const user = await getUser();
  return isVendorEmail(user?.email, process.env.VENDOR_EMAILS) ? 'vendor' : null;
}

/** Every ministry, or null when the server has no service key to read them. */
export async function loadMinistrySizes(): Promise<MinistrySize[] | null> {
  const db = serviceClient();
  return db ? ministrySizes(db) : null;
}
