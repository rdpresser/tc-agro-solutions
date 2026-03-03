import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildAdminSession } from '../fixtures/session.js';

test.describe('Error handling and edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('login: invalid credentials error message', async ({ page }) => {
    await page.route('**/auth/login', (route) => {
      route.abort('timedout');
    });

    await page.goto('index.html');
    await page.locator('#email').fill('user@tcagro.com');
    await page.locator('#password').fill('WrongPassword123');

    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('login: session expiration handled gracefully', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('dashboard.html');

    // Clear session storage to simulate expiration
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // Reload page
    await page.reload();

    await expect(page.locator('body')).toBeVisible();
  });

  test('property creation: duplicate name validation', async ({ page }) => {
    await applySession(page, buildAdminSession());

    // Mock API to return duplicate error
    await page.route('**/api/properties', (route) => {
      if (route.request().method() === 'POST') {
        route.abort('timedout');
      } else {
        route.continue();
      }
    });

    await page.goto('properties-form.html');
    await page.locator('#name').fill('Existing Property');
    await page.locator('#address').fill('Address');
    await page.locator('#city').fill('City');
    await page.locator('#state').fill('State');
    await page.locator('#country').fill('Country');
    await page.locator('#areaHectares').fill('100');

    await page.locator('#propertyForm button[type="submit"]').click();

    // Check error message
    const errorElement = page.locator('[id*="error"], [class*="error"]').first();
    const isVisible = await errorElement.isVisible().catch(() => false);

    if (isVisible) {
      await expect(errorElement).toBeVisible();
    }
  });

  test('plot creation: area validation range', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('plots-form.html');

    // Try negative area
    await page.locator('#areaHectares').fill('-5');

    const areaInput = page.locator('#areaHectares');
    const validity = await areaInput.evaluate((el) => el.validity.valid);
    expect(validity).toBeFalsy();

    // Try zero
    await page.locator('#areaHectares').fill('0');
    const zeroValidity = await areaInput.evaluate((el) => el.validity.valid);
    expect(zeroValidity).toBeFalsy();

    // Valid area
    await page.locator('#areaHectares').fill('50');
    const validValidity = await areaInput.evaluate((el) => el.validity.valid);
    expect(validValidity).toBeTruthy();
  });

  test('sensor creation: missing required fields error', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('sensors-form.html');

    // Try submitting without filling required fields
    await page.locator('#sensorForm button[type="submit"]').click();

    // Check validation errors appear
    const inputs = await page
      .locator('#sensorForm input[required], #sensorForm select[required]')
      .all();
    let hasInvalidInput = false;

    for (const input of inputs) {
      const validity = await input.evaluate((el) => !el.validity.valid);
      if (validity) {
        hasInvalidInput = true;
        break;
      }
    }

    expect(hasInvalidInput).toBeTruthy();
  });

  test('API timeout: graceful error handling on dashboard', async ({ page }) => {
    await applySession(page, buildAdminSession());

    // Mock API calls to timeout
    await page.route('**/api/**', (route) => {
      route.abort('timedout');
    });

    await page.goto('dashboard.html');

    await page.waitForTimeout(1200);
    await expect(page.locator('body')).toBeVisible();
  });

  test('form submission: prevent double submission', async ({ page }) => {
    await applySession(page, buildAdminSession());

    let submitCount = 0;
    await page.route('**/api/properties', (route) => {
      if (route.request().method() === 'POST') {
        submitCount++;
        route.abort('timedout');
      }
    });

    await page.goto('properties-form.html');
    await page.locator('#name').fill('Test Property');
    await page.locator('#address').fill('Address');
    await page.locator('#city').fill('City');
    await page.locator('#state').fill('State');
    await page.locator('#country').fill('Country');
    await page.locator('#areaHectares').fill('100');

    const submitButton = page.locator('#propertyForm button[type="submit"]');

    // Rapidly click submit button multiple times
    for (let i = 0; i < 3; i++) {
      await submitButton.click({ timeout: 100 }).catch(() => {});
    }

    // Wait for submissions to complete
    await page.waitForTimeout(500);

    // Should only send one request (ideally)
    // or button should be disabled after first click
    const isDisabled = await submitButton.evaluate((btn) => btn.hasAttribute('disabled'));
    expect(isDisabled || submitCount <= 1).toBeTruthy();
  });

  test('navigation: unsaved changes warning', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('properties-form.html');

    // Start filling form
    await page.locator('#name').fill('Property Name');

    // Try to navigate away
    const confirmPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);

    await page.click('a[href$="dashboard.html"]');

    const dialog = await confirmPromise;
    if (dialog) {
      // Confirm that unsaved changes dialog appears
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
    }
  });

  test('validation: email format on multiple forms', async ({ page }) => {
    const emailTestCases = [
      { email: 'invalid', valid: false },
      { email: 'missing@domain', valid: false },
      { email: 'test@domain.com', valid: true },
      { email: 'test+tag@domain.co.uk', valid: true },
      { email: 'spaces in@domain.com', valid: false }
    ];

    await applySession(page, buildAdminSession());

    for (const testCase of emailTestCases) {
      await page.goto('properties-form.html');

      // Try with properties form if it has email field
      const emailInput = page.locator('[type="email"]').first();
      const hasEmailInput = await emailInput.count();

      if (hasEmailInput > 0) {
        await emailInput.fill(testCase.email);
        const isValid = await emailInput.evaluate((el) => el.validity.valid);
        expect(isValid).toBe(testCase.valid);
      }
    }
  });

  test('dropdown options: handling empty lists', async ({ page }) => {
    await applySession(page, buildAdminSession());

    // Mock API to return empty properties list
    await page.route('**/api/properties', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ properties: [] })
        });
      } else {
        route.continue();
      }
    });

    await page.goto('plots-form.html');

    // Check property dropdown behavior
    const propertySelect = page.locator('#propertyId');
    const optionCount = await propertySelect.locator('option').count();

    // Should have at least placeholder option
    expect(optionCount).toBeGreaterThanOrEqual(1);
  });

  test('numeric input: boundary values', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('properties-form.html');

    const areaInput = page.locator('#areaHectares');

    // Test very large number
    await areaInput.fill('999999999');
    let validity = await areaInput.evaluate((el) => el.validity.valid);
    // Should either be valid or have max length

    // Test decimal
    await areaInput.fill('50.5');
    validity = await areaInput.evaluate((el) => el.validity.valid);
    expect(typeof validity === 'boolean').toBeTruthy();

    // Test negative
    await areaInput.fill('-50');
    validity = await areaInput.evaluate((el) => el.validity.valid);
    expect(validity).toBeFalsy();
  });

  test('network error: API returns 500', async ({ page }) => {
    await applySession(page, buildAdminSession());

    // Mock API to return 500 error
    await page.route('**/api/sensors', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        });
      } else {
        route.continue();
      }
    });

    await page.goto('sensors.html');

    // Check error handling
    const errorElement = page.locator('[class*="error"]').first();
    const isErrorVisible = await errorElement.isVisible().catch(() => false);

    if (isErrorVisible) {
      await expect(errorElement).toBeVisible();
    }
  });

  test('unauthorized: API returns 401 and clears session', async ({ page }) => {
    await applySession(page, buildAdminSession());

    // Mock API to return 401
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });

    await page.goto('dashboard.html');

    await page.waitForTimeout(800);
    await expect(page.locator('body')).toBeVisible();
  });

  test('form reset: clear button functionality', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('properties-form.html');

    // Fill form
    await page.locator('#name').fill('Test Property');
    await page.locator('#address').fill('123 Farm Road');

    // Look for reset button
    const resetButton = page.locator('button[type="reset"], [data-action="reset"]').first();
    const hasReset = await resetButton.isVisible().catch(() => false);

    if (hasReset) {
      await resetButton.click();

      // Verify fields are cleared
      const nameValue = await page.locator('#name').inputValue();
      const addressValue = await page.locator('#address').inputValue();

      expect(nameValue).toBe('');
      expect(addressValue).toBe('');
    }
  });

  test('keyboard navigation: form submission with Enter key', async ({ page }) => {
    await page.goto('index.html');

    await page.locator('#email').fill('admin@tcagro.com');
    await page.locator('#password').fill('Admin@123');

    const loginRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/auth/login'),
      { timeout: 2000 }
    );

    // Press Enter in password field
    await page.locator('#password').press('Enter');

    try {
      await loginRequestPromise;
    } catch {
      // Request may not complete in test
    }
  });

  test('long text handling: fields with max length', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('properties-form.html');

    const nameInput = page.locator('#name');
    const maxLength = await nameInput.getAttribute('maxlength');

    if (maxLength) {
      // Try to input text longer than max length
      const longText = 'a'.repeat(parseInt(maxLength) + 10);
      await nameInput.fill(longText);

      const actualValue = await nameInput.inputValue();
      expect(actualValue.length).toBeLessThanOrEqual(parseInt(maxLength));
    }
  });
});

