/**
 * E2E: API key lifecycle — create API key → verify key is shown → disable → delete.
 */
import { test, expect } from '@playwright/test';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace';

test.describe('API key lifecycle', () => {
  test('creates, disables, and deletes an API key', async ({ page }) => {
    // 1. Navigate to API keys page
    await page.goto(`/workspaces/${WORKSPACE_ID}/settings/api-keys`);
    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible();

    // 2. Create a new API key
    await page.getByRole('button', { name: /new.*key|create.*key|generate/i }).click();

    const uniqueName = `e2e-key-${Date.now()}`;
    const nameField = page.getByLabel(/name/i);
    await nameField.fill(uniqueName);
    await page.getByRole('button', { name: /create|generate|save/i }).click();

    // 3. The plaintext key is shown once — verify it appears
    const keyDialog = page.getByRole('dialog');
    await expect(keyDialog).toBeVisible({ timeout: 8000 });
    const keyText = keyDialog.getByText(/sk-/);
    await expect(keyText).toBeVisible();

    // Close the dialog
    await keyDialog.getByRole('button', { name: /close|done/i }).click();

    // 4. The key should now appear in the list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 8000 });

    // 5. Disable the key
    const keyRow = page.locator(`tr, [data-testid="api-key-row"]`).filter({ hasText: uniqueName });
    await keyRow.getByRole('button', { name: /disable/i }).click();
    const disableDialog = page.getByRole('dialog');
    if (await disableDialog.isVisible()) {
      await disableDialog.getByRole('button', { name: /confirm|disable/i }).click();
    }
    await expect(keyRow.getByText(/disabled/i)).toBeVisible({ timeout: 8000 });

    // 6. Delete the key
    await keyRow.getByRole('button', { name: /delete|remove/i }).click();
    const deleteDialog = page.getByRole('dialog');
    if (await deleteDialog.isVisible()) {
      await deleteDialog.getByRole('button', { name: /confirm|delete/i }).click();
    }
    await expect(page.getByText(uniqueName)).not.toBeVisible({ timeout: 8000 });
  });
});
