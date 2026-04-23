/**
 * Playwright test script for trading flow
 *
 * Usage: npx playwright test scripts/test-trading-playwright.ts --headed
 * Or: npx tsx scripts/test-trading-playwright.ts
 */

import { chromium, Browser, Page } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForUserSignIn(page: Page) {
  console.log('\n========================================');
  console.log('PLEASE SIGN IN MANUALLY IN THE BROWSER');
  console.log('========================================\n');

  // Wait for the user to be signed in - check for predictions page or trading elements
  let signedIn = false;
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes

  while (!signedIn && attempts < maxAttempts) {
    try {
      // Check if we're on predictions page with trading UI
      const hasTradingUI = await page.locator('button:has-text("Buy"), button:has-text("Long"), button:has-text("Short")').first().isVisible({ timeout: 1000 }).catch(() => false);

      if (hasTradingUI) {
        signedIn = true;
        console.log('✓ User appears to be signed in - trading UI detected');
      } else {
        attempts++;
        if (attempts % 10 === 0) {
          console.log(`Waiting for sign in... (${attempts}s)`);
        }
        await sleep(1000);
      }
    } catch {
      attempts++;
      await sleep(1000);
    }
  }

  if (!signedIn) {
    throw new Error('Timed out waiting for user to sign in');
  }
}

async function attemptTrade(page: Page): Promise<boolean> {
  console.log('\n--- Attempting trade ---');

  try {
    // Look for a buy/long button
    const buyButton = page.locator('button:has-text("Long"), button:has-text("Buy Long")').first();

    if (await buyButton.isVisible({ timeout: 5000 })) {
      console.log('Found Buy/Long button, clicking...');
      await buyButton.click();

      // Wait for any modal or input to appear
      await sleep(1000);

      // Look for amount input and enter $1
      const amountInput = page.locator('input[type="number"], input[placeholder*="amount"], input[placeholder*="Amount"]').first();
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Found amount input, entering $1...');
        await amountInput.fill('1');
      }

      // Look for confirm/submit button
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Place Order"), button:has-text("Buy")').last();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Found confirm button, clicking...');
        await confirmButton.click();

        // Wait for response
        await sleep(3000);

        // Check for success or error
        const successMessage = await page.locator('text=/success|confirmed|placed/i').isVisible({ timeout: 5000 }).catch(() => false);
        const errorMessage = await page.locator('text=/error|failed|credentials/i').isVisible({ timeout: 1000 }).catch(() => false);

        if (successMessage) {
          console.log('✓ TRADE SUCCESSFUL!');
          return true;
        } else if (errorMessage) {
          const errorText = await page.locator('text=/error|failed|credentials/i').first().textContent().catch(() => 'Unknown error');
          console.log('✗ Trade failed:', errorText);
          return false;
        }
      }
    }

    console.log('Could not complete trade flow - UI elements not found as expected');
    return false;
  } catch (error) {
    console.error('Error during trade attempt:', error);
    return false;
  }
}

async function main() {
  console.log('Launching browser...');

  const browser: Browser = await chromium.launch({
    headless: false, // Show browser window
    slowMo: 100, // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Listen to console messages from the page
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('trading') || msg.text().includes('credential')) {
      console.log(`[Browser Console] ${msg.text()}`);
    }
  });

  // Listen to network responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/trading/')) {
      const status = response.status();
      console.log(`[Network] ${response.request().method()} ${url} - ${status}`);

      if (status >= 400) {
        try {
          const body = await response.json();
          console.log(`[Network Error] ${JSON.stringify(body)}`);
        } catch {
          // Not JSON
        }
      }
    }
  });

  try {
    console.log(`Navigating to ${BASE_URL}/predictions...`);
    await page.goto(`${BASE_URL}/predictions`, { waitUntil: 'networkidle' });

    // Wait for user to sign in
    await waitForUserSignIn(page);

    // Give a moment after sign in
    await sleep(2000);

    // Try to make a trade
    let tradeSuccess = false;
    let attempts = 0;
    const maxTradeAttempts = 5;

    while (!tradeSuccess && attempts < maxTradeAttempts) {
      attempts++;
      console.log(`\nTrade attempt ${attempts}/${maxTradeAttempts}`);

      tradeSuccess = await attemptTrade(page);

      if (!tradeSuccess) {
        console.log('Waiting before retry...');
        await sleep(3000);

        // Refresh page to retry
        await page.reload({ waitUntil: 'networkidle' });
        await sleep(2000);
      }
    }

    if (tradeSuccess) {
      console.log('\n========================================');
      console.log('SUCCESS! Trade completed successfully.');
      console.log('========================================\n');
    } else {
      console.log('\n========================================');
      console.log('FAILED: Could not complete trade after', maxTradeAttempts, 'attempts');
      console.log('Check the server logs for more details.');
      console.log('========================================\n');
    }

    // Keep browser open for inspection
    console.log('Browser will stay open for 30 seconds for inspection...');
    await sleep(30000);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
