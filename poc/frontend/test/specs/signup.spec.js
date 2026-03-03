import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';

function parsePayload(request) {
  return JSON.parse(request.postData() || '{}');
}

test.describe('Signup flow', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders signup fields and default role', async ({ page }) => {
    await page.goto('signup.html');

    await expect(page.locator('#signupForm')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#role')).toHaveValue('Producer');
    await expect(page.locator('#role')).toBeDisabled();
  });

  test('invalid email blocks submit', async ({ page }) => {
    await page.goto('signup.html');

    await page.locator('#name').fill('John Producer');
    await page.locator('#email').fill('invalid-email');
    await page.locator('#username').fill('johnproducer');
    await page.locator('#password').fill('Test@1234');

    await page.locator('#signupBtn').click();

    await expect(page.locator('#formErrors')).toBeVisible();
  });

  test('successful signup posts payload and redirects to sign-in', async ({ page }) => {
    await page.goto('signup.html');

    await page.locator('#name').fill('Jane Producer');
    await page.locator('#email').fill('jane@farm.com');
    await page.locator('#username').fill('janeproducer');
    await page.locator('#password').fill('Secure@2026');

    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/auth/register')
    );

    await Promise.all([page.waitForURL(/index\.html\?email=/), page.locator('#signupBtn').click()]);

    const request = await requestPromise;
    const payload = parsePayload(request);

    expect(payload.name).toBe('Jane Producer');
    expect(payload.email).toBe('jane@farm.com');
    expect(payload.username).toBe('janeproducer');
    expect(payload.password).toBe('Secure@2026');
    expect(payload.role).toBe('Producer');
  });

  test('double-click unlocks role selector', async ({ page }) => {
    await page.goto('signup.html');

    await page.evaluate(() => {
      const roleGroup = document.getElementById('roleGroup');
      roleGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      roleGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect
      .poll(async () => page.locator('#role').isDisabled(), { timeout: 8000 })
      .toBe(false);
    await page.locator('#role').selectOption('Admin');
    await expect(page.locator('#role')).toHaveValue('Admin');
  });

  test('email availability check endpoint is called', async ({ page }) => {
    await page.goto('signup.html');

    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'GET' && request.url().includes('/auth/check-email/')
    );

    await page.locator('#email').fill('available@farm.com');
    await page.waitForTimeout(700);

    await requestPromise;
    await expect(page.locator('#emailAvailabilityIcon')).toBeVisible();
  });
});

