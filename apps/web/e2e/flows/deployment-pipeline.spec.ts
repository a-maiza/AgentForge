/**
 * E2E: Deployment pipeline — deploy DEV → STAGING → PROD.
 *
 * Prerequisites:
 *   - A prompt with at least one version must already exist
 *   - E2E_PROMPT_ID env var points to that prompt's ID
 */
import { test, expect } from '@playwright/test';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace';
const PROMPT_ID = process.env.E2E_PROMPT_ID ?? '';

test.describe('Deployment pipeline', () => {
  test.skip(!PROMPT_ID, 'E2E_PROMPT_ID not set — skipping deployment pipeline test');

  test('deploys prompt through DEV → STAGING → PROD', async ({ page }) => {
    // 1. Navigate to the prompt detail page
    await page.goto(`/workspaces/${WORKSPACE_ID}/prompts/${PROMPT_ID}`);
    await expect(page.getByRole('heading')).toBeVisible();

    // 2. Open the deployments tab
    await page.getByRole('tab', { name: /deploy/i }).click();

    // 3. Deploy to DEV
    await page.getByRole('button', { name: /deploy to dev/i }).click();
    const devDialog = page.getByRole('dialog');
    await expect(devDialog).toBeVisible();
    await devDialog.getByRole('button', { name: /confirm|deploy/i }).click();
    await expect(page.getByText(/deployed to dev/i)).toBeVisible({ timeout: 15000 });

    // 4. Promote DEV → STAGING
    await page.getByRole('button', { name: /promote.*staging|staging/i }).first().click();
    const stagingDialog = page.getByRole('dialog');
    await expect(stagingDialog).toBeVisible();
    await stagingDialog.getByRole('button', { name: /confirm|promote/i }).click();
    await expect(page.getByText(/staging/i)).toBeVisible({ timeout: 15000 });

    // 5. Promote STAGING → PROD
    await page.getByRole('button', { name: /promote.*prod|production/i }).first().click();
    const prodDialog = page.getByRole('dialog');
    await expect(prodDialog).toBeVisible();
    await prodDialog.getByRole('button', { name: /confirm|promote/i }).click();
    await expect(page.getByText(/prod|production/i)).toBeVisible({ timeout: 15000 });
  });
});
