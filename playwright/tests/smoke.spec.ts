import { test, expect } from '@playwright/test';

test.describe('WhatsApp Automation Dashboard Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Vite local dev server address
    await page.goto('/');
  });

  test('should load the wizard dashboard layout with correct sidebar tab elements', async ({ page }) => {
    // Check that sidebar brand header is visible
    await expect(page.locator('h1:has-text("WA Automator")')).toBeVisible();

    // Verify sidebar navigation tabs exist
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Campaigns")')).toBeVisible();
    await expect(page.locator('button:has-text("Templates")')).toBeVisible();
    await expect(page.locator('button:has-text("History")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
  });

  test('should display CSV import card on Step 1 initially', async ({ page }) => {
    // Click Campaigns tab to open the wizard flow
    await page.click('button:has-text("Campaigns")');

    // Verify file uploader zone and instructions appear on step 1
    await expect(page.locator('text=Import Your Contacts')).toBeVisible();
    await expect(page.locator('text=Browse Files')).toBeVisible();
  });
});
