import type { Page } from '@playwright/test';

export class PromptsPage {
  constructor(private readonly page: Page) {}

  async goto(workspaceId: string) {
    await this.page.goto(`/workspaces/${workspaceId}/prompts`);
  }

  async clickNewPrompt() {
    await this.page.getByRole('button', { name: /new prompt/i }).click();
  }

  async fillName(name: string) {
    await this.page.getByLabel(/name/i).fill(name);
  }

  async fillContent(content: string) {
    const editor = this.page.getByRole('textbox', { name: /content/i });
    await editor.fill(content);
  }

  async save() {
    await this.page.getByRole('button', { name: /save|create/i }).click();
  }

  async openPrompt(name: string) {
    await this.page.getByRole('link', { name }).click();
  }
}
