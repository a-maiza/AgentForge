/**
 * E2E: Prompt lifecycle — create → version → evaluate → view result.
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_APP_URL points to a running AgentForge instance
 *   - E2E_WORKSPACE_ID is the workspace to use for tests
 *   - Auth storage state populated by global-setup.ts
 */
import { test, expect } from '@playwright/test';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace';

test.describe('Prompt lifecycle', () => {
  test('creates a prompt, saves a new version, and navigates to evaluation', async ({ page }) => {
    // 1. Navigate to prompts list
    await page.goto(`/workspaces/${WORKSPACE_ID}/prompts`);
    await expect(page.getByRole('heading', { name: /prompts/i })).toBeVisible();

    // 2. Open the create prompt dialog / form
    await page.getByRole('button', { name: /new prompt/i }).click();

    // 3. Fill in prompt details
    const uniqueName = `E2E Prompt ${Date.now()}`;
    await page.getByLabel(/name/i).fill(uniqueName);
    await page.getByRole('textbox', { name: /content/i }).fill(
      'Summarise the following text: {{input}}',
    );

    // 4. Save the prompt (creates version 1)
    await page.getByRole('button', { name: /save|create/i }).click();

    // 5. Verify the prompt appears in the list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });

    // 6. Open the prompt detail
    await page.getByText(uniqueName).click();
    await expect(page.getByText(/version 1/i)).toBeVisible({ timeout: 8000 });

    // 7. Edit the content to create version 2
    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByRole('textbox', { name: /content/i }).fill(
      'Summarise the following text in {{language}}: {{input}}',
    );
    await page.getByRole('button', { name: /save/i }).click();

    // Version 2 should now exist
    await expect(page.getByText(/version 2/i)).toBeVisible({ timeout: 8000 });

    // 8. Navigate to evaluations for this prompt
    await page.getByRole('link', { name: /evaluate|evaluation/i }).first().click();
    await expect(page.url()).toContain('/evaluations');
  });
});
