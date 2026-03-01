import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';

test.describe('Authentication', () => {
  test('login redirects to dashboard and stores session', async ({ page }) => {
    await installApiMocks(page);

    await page.goto('/index.html');

    await page.locator('#email').fill('admin@tcagro.com');
    await page.locator('#password').fill('Admin@123');
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page).toHaveURL(/dashboard\.html/);

    const token = await page.evaluate(() => window.sessionStorage.getItem('agro_token'));
    const user = await page.evaluate(() => window.sessionStorage.getItem('agro_user'));

    expect(token).toBeTruthy();
    expect(user).toContain('admin@tcagro.com');
  });
});
