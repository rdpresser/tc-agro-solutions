import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';

function parsePayload(request) {
  return JSON.parse(request.postData() || '{}');
}

test.describe('Change password flow', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders form fields', async ({ page }) => {
    await page.goto('/change-password.html');

    await expect(page.locator('#changePasswordForm')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#changePasswordBtn')).toBeVisible();
  });

  test('invalid email shows validation error', async ({ page }) => {
    await page.goto('/change-password.html');

    await page.locator('#email').fill('invalid-email');
    await page.locator('#password').fill('NewSecure@2026');
    await page.locator('#changePasswordBtn').click();

    await expect(page.locator('#formErrors')).toBeVisible();
  });

  test('successful password change posts payload and redirects', async ({ page }) => {
    await page.goto('/change-password.html');

    await page.locator('#email').fill('admin@tcagro.com');
    await page.locator('#password').fill('NewSecure@2026');

    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/auth/change-password')
    );

    await Promise.all([
      page.waitForURL(/index\.html\?email=/),
      page.locator('#changePasswordBtn').click()
    ]);

    const request = await requestPromise;
    const payload = parsePayload(request);

    expect(payload.email).toBe('admin@tcagro.com');
    expect(payload.password).toBe('NewSecure@2026');
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/change-password.html');

    const passwordInput = page.locator('#password');
    const toggleButton = page.locator('#togglePassword');

    await expect(passwordInput).toHaveAttribute('type', 'password');
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
