import { defineConfig, devices } from '@playwright/test';

// Unusual ports so e2e never meets a dev server or a real backend. The stand-in and the app are always started fresh.
const STANDIN_PORT = 54391;
const APP_PORT = 3100;
process.env.STANDIN_PORT = String(STANDIN_PORT);

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
          args: ['--no-sandbox'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/standin-supabase.mjs',
      url: `http://127.0.0.1:${STANDIN_PORT}/__state`,
      env: { STANDIN_PORT: String(STANDIN_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm start -- -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}/games`,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${STANDIN_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      },
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
