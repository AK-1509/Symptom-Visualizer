import { defineConfig, devices } from '@playwright/test';

/** Core journey against the production build served by `vite preview`. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1000 } }, grep: /layout/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
