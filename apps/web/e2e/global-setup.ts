import { chromium } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

export default async function globalSetup() {
  const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[global-setup] E2E_USER_EMAIL / E2E_USER_PASSWORD not set — skipping auth setup.',
    );
    // Write empty storage state so Playwright doesn't fail loading it
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.storageState({ path: AUTH_FILE });
    await browser.close();
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/sign-in`);

  // Clerk sign-in form
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /continue|sign in/i }).click();

  // Wait for redirect to dashboard after successful sign-in
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}
