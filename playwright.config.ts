import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const databasePath = join(tmpdir(), `sudokuell-e2e-${randomUUID()}.sqlite`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      SUDOKUELL_DB_PATH: databasePath,
    },
  },
});
