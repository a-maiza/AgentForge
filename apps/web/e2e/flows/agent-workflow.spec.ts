/**
 * E2E: Agent workflow — build workflow in Workflow Studio → trigger test run.
 */
import { test, expect } from '@playwright/test';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace';

test.describe('Agent workflow', () => {
  test('creates an agent and performs a test run', async ({ page }) => {
    // 1. Navigate to agents list
    await page.goto(`/workspaces/${WORKSPACE_ID}/agents`);
    await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible();

    // 2. Create a new agent
    await page.getByRole('button', { name: /new agent/i }).click();

    const uniqueName = `E2E Agent ${Date.now()}`;
    await page.getByLabel(/name/i).fill(uniqueName);
    await page.getByRole('button', { name: /save|create/i }).click();

    // 3. Verify agent appears in list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });

    // 4. Open the agent detail / Workflow Studio
    await page.getByText(uniqueName).click();
    await expect(page.getByText(/workflow/i)).toBeVisible({ timeout: 8000 });

    // 5. Add a node via the palette (if canvas is present)
    const canvas = page.locator('[data-testid="react-flow"], .react-flow');
    if (await canvas.isVisible()) {
      // Try to add an LLM node from the palette
      const llmButton = page.getByRole('button', { name: /llm|add node/i }).first();
      if (await llmButton.isVisible()) {
        await llmButton.click();
      }
    }

    // 6. Save the workflow
    const saveButton = page.getByRole('button', { name: /save workflow/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 8000 });
    }

    // 7. Trigger a test run
    await page.getByRole('button', { name: /test run|run/i }).first().click();
    const testRunDialog = page.getByRole('dialog');
    if (await testRunDialog.isVisible()) {
      const inputField = testRunDialog.getByRole('textbox');
      if (await inputField.isVisible()) {
        await inputField.fill('Hello, world!');
      }
      await testRunDialog.getByRole('button', { name: /run|submit/i }).click();
    }

    // 8. Verify a test run response appears
    await expect(
      page.getByText(/result|output|success|completed/i).first(),
    ).toBeVisible({ timeout: 20000 });
  });
});
