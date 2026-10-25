/* Browser smoke tests, in demo mode (no Supabase): the flows a ministry
   leans on every week, on a phone and at a desk. `npm run e2e` starts the
   app itself; point E2E_BASE_URL at a running one to skip that. */
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3300);
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:' + port;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', testMatch: /phone\.spec\.ts/, use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desk', testMatch: /desk\.spec\.ts/, use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx next dev -p ' + port,
        url: baseURL + '/login',
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        /* Demo mode: no backend, the seeded ministry on this device. */
        env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
      }
});
