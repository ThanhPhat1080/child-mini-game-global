import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ACCOUNTS } from './fixtures';

export const CHILD_STATE = 'e2e/.auth/child.json';

/** Signs the child in once and saves the session; every spec starts as that child unless it overrides storageState (U9). */
export default async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const browser = await chromium.launch(project.use.launchOptions);
  const page = await browser.newPage({ baseURL: project.use.baseURL });
  await page.goto('/play/sign-in');
  await page.getByLabel('Email').fill(ACCOUNTS.child.email);
  await page.getByLabel('Password').fill(ACCOUNTS.child.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/games');
  mkdirSync('e2e/.auth', { recursive: true });
  await page.context().storageState({ path: CHILD_STATE });
  await browser.close();
}
