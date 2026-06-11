import { test, expect } from '@playwright/test';

// Define a maximum number of pages to crawl to prevent infinite loops or excessively long runs
const MAX_PAGES_TO_CRAWL = 200;

// Exclude patterns that might be external, actions, or unwanted routes
const EXCLUDE_PATTERNS = [
  /^mailto:/,
  /^tel:/,
  /^http/, // Exclude external links
  /\.(png|jpg|jpeg|gif|svg|pdf|zip)$/i, // Exclude files
];

test.describe('Automated App Crawler', () => {
  test('should visit all internal links without encountering errors', async ({ page, baseURL }) => {
    // Increase test timeout significantly for the crawler
    test.setTimeout(5 * 60 * 1000); // 5 minutes

    const visited = new Set<string>();
    const queue = new Set<string>();
    const failedUrls: { url: string; error: string }[] = [];

    // Start at the dashboard/root
    queue.add('/');

    // Listen for uncaught exceptions or console errors
    const consoleErrors: { url: string; error: string }[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected/benign errors if necessary, but log others
        if (!text.includes('favicon.ico') && !text.includes('404')) {
           consoleErrors.push({ url: page.url(), error: text });
        }
      }
    });

    page.on('pageerror', (exception) => {
      consoleErrors.push({ url: page.url(), error: exception.message });
    });

    while (queue.size > 0 && visited.size < MAX_PAGES_TO_CRAWL) {
      const currentUrl = Array.from(queue)[0];
      queue.delete(currentUrl);

      if (visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);
      console.log(`Crawling: ${currentUrl} (${visited.size}/${MAX_PAGES_TO_CRAWL})`);

      try {
        await page.goto(currentUrl, { waitUntil: 'networkidle' });
        
        // Add a delay to avoid hitting the backend API rate limits (60 requests/min in dev mode)
        await page.waitForTimeout(1500);

        // Assert 1: Check for generic Error Boundaries or Next.js error pages
        const errorBoundaryText = page.locator('text=Something went wrong').first();
        const appErrorText = page.locator('text=Application error: a client-side exception has occurred').first();
        
        const hasErrorBoundary = await errorBoundaryText.isVisible();
        const hasAppError = await appErrorText.isVisible();

        if (hasErrorBoundary || hasAppError) {
          failedUrls.push({ url: currentUrl, error: 'React Error Boundary or Next.js Client Error triggered.' });
        }

        // Collect new links from this page
        const hrefs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.getAttribute('href'))
            .filter(href => href !== null);
        });

        for (const href of hrefs) {
          if (!href) continue;

          // Normalize the URL
          let normalized = href.split('#')[0].split('?')[0]; // Strip hash and query params for uniqueness

          // Check if it's an internal path
          const isExternal = EXCLUDE_PATTERNS.some(pattern => pattern.test(normalized));
          
          if (!isExternal && normalized.startsWith('/')) {
            if (!visited.has(normalized)) {
              queue.add(normalized);
            }
          }
        }
      } catch (err: any) {
        failedUrls.push({ url: currentUrl, error: `Navigation failed: ${err.message}` });
      }
    }

    // After crawling, output results
    console.log(`Crawled ${visited.size} pages successfully.`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors/Exceptions encountered:');
      console.log(consoleErrors);
    }

    if (failedUrls.length > 0) {
      console.error('Failed URLs:');
      console.error(failedUrls);
    }

    // The test passes only if there were no page failures
    expect(failedUrls, `Failed on ${failedUrls.length} pages`).toHaveLength(0);
  });
});
