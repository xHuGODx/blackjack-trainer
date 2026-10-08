import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    launchOptions: existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 393, height: 851 } } },
  ],
  webServer: { command: 'npm run start -- --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: !process.env.CI },
});
