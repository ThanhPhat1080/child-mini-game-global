import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pickChild, signInOnDevice } from './fixtures';

export const CHILD_STATE = 'e2e/.auth/child.json';

/** Signs the parent in on the play device and picks the seed child (PIN 1234); every spec starts from that state unless it overrides storageState (U9, K8-K10). */
export default async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const browser = await chromium.launch(project.use.launchOptions);
  const page = await browser.newPage({ baseURL: project.use.baseURL });
  await signInOnDevice(page);
  await pickChild(page);
  mkdirSync('e2e/.auth', { recursive: true });
  await page.context().storageState({ path: CHILD_STATE });
  await browser.close();
}
