/**
 * Clinical Decision Support System - E2E Tests
 * Comprehensive end-to-end testing with Playwright
 * Tests complete user workflows from frontend to backend
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebSocket } from 'ws';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';
const WS_URL = process.env.WS_URL || 'ws://localhost:8000';

// Test data
const testQueries = {
  simple: "What are the symptoms of diabetes?",
  complex: "65-year-old male with chest pain, history of hypertension and diabetes. What are the diagnostic steps and treatment options?",
  malicious: "<script>alert('xss')</script>",
  sqlInjection: "'; DROP TABLE patients; --"
};

const patientContext = {
  age: 65,
  gender: "male",
  medicalHistory: ["hypertension", "diabetes"],
  currentMedications: ["metformin", "lisinopril"]
};

test.describe('Clinical Decision Support System - E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['microphone'], // For voice input tests
    });
    page = await context.newPage();
    
    // Setup API monitoring
    await page.route('**/api/**', route => {
      console.log(`API Request: ${route.request().method()} ${route.request().url()}`);
      route.continue();
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Application Loading and Navigation', () => {
    test('should load the application successfully', async () => {
      // Navigate to the application
      const response = await page.goto(BASE_URL);
      expect(response?.status()).toBe(200);

      // Check if main navigation is present
      await expect(page.locator('[data-testid="navbar"]')).toBeVisible();
      
      // Verify title
      await expect(page).toHaveTitle(/Clinical Decision Support/i);
      
      // Check for essential UI elements
      await expect(page.locator('text=CDSS')).toBeVisible();
      await expect(page.locator('text=Clinical Decision Support')).toBeVisible();
    });

    test('should navigate between pages correctly', async () => {
      await page.goto(BASE_URL);
      
      // Test navigation to different pages
      const navigationTests = [
        { link: 'Dashboard', expectedUrl: '/dashboard' },
        { link: 'Clinical Query', expectedUrl: '/query' },
        { link: 'Recent Papers', expectedUrl: '/papers' },
        { link: 'Settings', expectedUrl: '/settings' }
      ];

      for (const navTest of navigationTests) {
        await page.click(`text=${navTest.link}`);
        await expect(page).toHaveURL(new RegExp(navTest.expectedUrl));
        
        // Verify page loaded correctly
        await expect(page.locator('main')).toBeVisible();
      }
    });

    test('should display connection status indicator', async () => {
      await page.goto(BASE_URL);
      
      // Check for connection status indicator
      const statusIndicator = page.locator('[data-testid="connection-status"]');
      await expect(statusIndicator).toBeVisible();
      
      // Should show either "Live" or "Offline"
      await expect(statusIndicator).toContainText(/Live|Offline/);
    });
  });

  test.describe('Clinical Query Functionality', () => {
    test.beforeEach(async () => {
      await page.goto(`${BASE_URL}/query`);
    });

    test('should submit a simple clinical query successfully', async () => {
      // Fill in the query
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      
      // Submit the query
      await page.click('[data-testid="submit-query-button"]');
      
      // Wait for processing to start
      await expect(page.locator('text=Processing')).toBeVisible({ timeout: 10000 });
      
      // Wait for results (with generous timeout for AI processing)
      await expect(page.locator('[data-testid="clinical-results"]')).toBeVisible({ 
        timeout: 60000 
      });
      
      // Verify results contain expected elements
      await expect(page.locator('[data-testid="recommendation-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible();
    });

    test('should handle complex clinical query with patient context', async () => {
      // Navigate to advanced form
      await page.click('[data-testid="show-advanced-options"]');
      
      // Fill in complex query
      await page.fill('[data-testid="clinical-query-input"]', testQueries.complex);
      
      // Fill patient context
      await page.fill('[data-testid="patient-age"]', patientContext.age.toString());
      await page.selectOption('[data-testid="patient-gender"]', patientContext.gender);
      
      // Add medical history
      for (const condition of patientContext.medicalHistory) {
        await page.click('[data-testid="medical-history-select"]');
        await page.click(`text=${condition}`);
      }
      
      // Submit query
      await page.click('[data-testid="submit-query-button"]');
      
      // Verify processing steps are shown
      const processingSteps = [
        'Analyzing Query',
        'Searching Literature', 
        'Creating Embeddings',
        'Matching Evidence',
        'Generating Recommendations'
      ];
      
      for (const step of processingSteps) {
        await expect(page.locator(`text=${step}`)).toBeVisible({ timeout: 15000 });
      }
      
      // Wait for final results
      await expect(page.locator('[data-testid="clinical-results"]')).toBeVisible({ 
        timeout: 120000 
      });
      
      // Verify comprehensive results
      await expect(page.locator('[data-testid="risk-assessment"]')).toBeVisible();
      await expect(page.locator('[data-testid="evidence-sources"]')).toBeVisible();
    });

    test('should handle voice input functionality', async () => {
      // Grant microphone permissions
      await context.grantPermissions(['microphone']);
      
      // Click voice input button
      await page.click('[data-testid="voice-input-button"]');
      
      // Verify microphone is active
      await expect(page.locator('[data-testid="voice-input-button"]')).toHaveClass(/listening/);
      
      // Stop voice input
      await page.click('[data-testid="voice-input-button"]');
      
      // Verify stopped
      await expect(page.locator('[data-testid="voice-input-button"]')).not.toHaveClass(/listening/);
    });

    test('should validate and reject malicious input', async () => {
      // Test XSS attempt
      await page.fill('[data-testid="clinical-query-input"]', testQueries.malicious);
      await page.click('[data-testid="submit-query-button"]');
      
      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=harmful')).toBeVisible();
      
      // Clear and test SQL injection
      await page.fill('[data-testid="clinical-query-input"]', testQueries.sqlInjection);
      await page.click('[data-testid="submit-query-button"]');
      
      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });

    test('should support query suggestions', async () => {
      // Click on a suggestion chip
      await page.click('[data-testid="suggestion-chip"]:first-child');
      
      // Verify query input is filled
      const queryInput = page.locator('[data-testid="clinical-query-input"]');
      await expect(queryInput).not.toHaveValue('');
      
      // Verify suggestion was added
      const inputValue = await queryInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(10);
    });

    test('should handle query history and bookmarks', async () => {
      // Submit a query first
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      await page.click('[data-testid="submit-query-button"]');
      
      // Wait for results
      await expect(page.locator('[data-testid="clinical-results"]')).toBeVisible({ 
        timeout: 60000 
      });
      
      // Bookmark the result
      await page.click('[data-testid="bookmark-button"]');
      
      // Verify bookmark confirmation
      await expect(page.locator('text=Saved to bookmarks')).toBeVisible();
      
      // Test download functionality
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-report-button"]');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/clinical-report.*\.json/);
    });
  });

  test.describe('Real-time WebSocket Communication', () => {
    test('should establish WebSocket connection', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      // Monitor WebSocket connections
      const wsMessages: any[] = [];
      
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          wsMessages.push(JSON.parse(event.payload.toString()));
        });
      });
      
      // Submit a query to trigger WebSocket communication
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      await page.click('[data-testid="submit-query-button"]');
      
      // Wait for WebSocket messages
      await page.waitForTimeout(5000);
      
      // Verify WebSocket messages were received
      expect(wsMessages.length).toBeGreaterThan(0);
      
      // Check for expected message types
      const messageTypes = wsMessages.map(msg => msg.type);
      expect(messageTypes).toContain('welcome');
    });

    test('should show real-time processing updates', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      // Submit query
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      await page.click('[data-testid="submit-query-button"]');
      
      // Verify real-time updates appear
      await expect(page.locator('[data-testid="processing-step"]')).toBeVisible();
      
      // Check that steps progress
      const steps = await page.locator('[data-testid="processing-step"]').count();
      expect(steps).toBeGreaterThan(0);
      
      // Verify completion
      await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ 
        timeout: 120000 
      });
    });

    test('should handle WebSocket disconnection gracefully', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      // Verify initial connection
      await expect(page.locator('text=Live')).toBeVisible();
      
      // Simulate network disconnection
      await page.context().setOffline(true);
      
      // Should show offline status
      await expect(page.locator('text=Offline')).toBeVisible({ timeout: 10000 });
      
      // Restore connection
      await page.context().setOffline(false);
      
      // Should reconnect
      await expect(page.locator('text=Live')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Monitoring Dashboard', () => {
    test.beforeEach(async () => {
      await page.goto(`${BASE_URL}/dashboard`);
    });

    test('should display system metrics', async () => {
      // Check for metric cards
      const metricCards = [
        'CPU Usage',
        'Memory Usage', 
        'Response Time',
        'Active Users',
        'Queries/Min',
        'Error Rate'
      ];
      
      for (const metric of metricCards) {
        await expect(page.locator(`text=${metric}`)).toBeVisible();
      }
      
      // Verify metric values are displayed
      await expect(page.locator('[data-testid="metric-value"]').first()).toBeVisible();
    });

    test('should display real-time charts', async () => {
      // Check for chart containers
      await expect(page.locator('[data-testid="system-performance-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-health-chart"]')).toBeVisible();
      
      // Verify charts render
      await expect(page.locator('.recharts-wrapper')).toBeVisible();
    });

    test('should show service status', async () => {
      // Check for service status cards
      const services = [
        'API Gateway',
        'RAG Service', 
        'Vector DB',
        'PubMed Service',
        'WebSocket',
        'Redis Cache'
      ];
      
      for (const service of services) {
        await expect(page.locator(`text=${service}`)).toBeVisible();
      }
      
      // Verify status indicators
      await expect(page.locator('[data-testid="service-status-indicator"]')).toHaveCount(services.length);
    });

    test('should handle alerts and notifications', async () => {
      // Look for active alerts section
      const alertsSection = page.locator('[data-testid="alerts-panel"]');
      
      if (await alertsSection.isVisible()) {
        // If alerts are present, test alert handling
        await expect(page.locator('[data-testid="alert-item"]')).toBeVisible();
        
        // Test alert acknowledgment
        if (await page.locator('[data-testid="acknowledge-alert-button"]').isVisible()) {
          await page.click('[data-testid="acknowledge-alert-button"]');
          await expect(page.locator('text=acknowledged')).toBeVisible();
        }
      }
    });

    test('should allow time range selection', async () => {
      // Test time range selector
      await page.click('[data-testid="time-range-selector"]');
      await page.click('text=Last 6 Hours');
      
      // Verify charts update (check for loading state)
      await expect(page.locator('[data-testid="chart-loading"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="chart-loading"]')).toBeHidden({ timeout: 10000 });
    });

    test('should support dashboard export', async () => {
      // Test export functionality
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-dashboard-button"]');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/dashboard.*\.(pdf|png|csv)/);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API failure
      await page.route('**/api/v1/clinical-query', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ detail: 'Internal server error' })
        });
      });
      
      await page.goto(`${BASE_URL}/query`);
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      await page.click('[data-testid="submit-query-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=error')).toBeVisible();
    });

    test('should handle network timeout', async () => {
      // Mock slow API response
      await page.route('**/api/v1/clinical-query', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ message: 'success' })
          });
        }, 30000); // 30 second delay
      });
      
      await page.goto(`${BASE_URL}/query`);
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      await page.click('[data-testid="submit-query-button"]');
      
      // Should show timeout handling
      await expect(page.locator('text=timeout')).toBeVisible({ timeout: 35000 });
    });

    test('should validate empty form submissions', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      // Try to submit empty query
      await page.click('[data-testid="submit-query-button"]');
      
      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('text=required')).toBeVisible();
    });

    test('should handle browser back/forward navigation', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.goto(`${BASE_URL}/query`);
      
      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/dashboard/);
      
      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(/query/);
      
      // Verify page state is maintained
      await expect(page.locator('[data-testid="clinical-query-input"]')).toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should meet performance benchmarks', async () => {
      // Navigate to main page and measure performance
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await expect(page.locator('main')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Check Core Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise(resolve => {
          new PerformanceObserver(list => {
            const entries = list.getEntries();
            resolve(entries.map(entry => ({
              name: entry.name,
              duration: entry.duration || entry.value
            })));
          }).observe({ entryTypes: ['measure', 'navigation'] });
        });
      });
      
      expect(metrics).toBeDefined();
    });

    test('should be accessible to screen readers', async () => {
      await page.goto(BASE_URL);
      
      // Check for ARIA labels and roles
      await expect(page.locator('[role="navigation"]')).toBeVisible();
      await expect(page.locator('[role="main"]')).toBeVisible();
      
      // Check for alt text on images
      const images = await page.locator('img').count();
      if (images > 0) {
        await expect(page.locator('img[alt]')).toHaveCount(images);
      }
      
      // Check form labels
      await page.goto(`${BASE_URL}/query`);
      const formInputs = await page.locator('input, textarea, select').count();
      if (formInputs > 0) {
        // Should have associated labels or aria-labels
        const labeledInputs = await page.locator('input[aria-label], textarea[aria-label], select[aria-label], input[aria-labelledby], textarea[aria-labelledby], select[aria-labelledby]').count();
        expect(labeledInputs).toBeGreaterThan(0);
      }
    });

    test('should work on mobile viewports', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      
      // Check mobile navigation
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Test mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test mobile query form
      await page.goto(`${BASE_URL}/query`);
      await expect(page.locator('[data-testid="clinical-query-input"]')).toBeVisible();
      
      // Form should be usable on mobile
      await page.fill('[data-testid="clinical-query-input"]', testQueries.simple);
      expect(await page.locator('[data-testid="clinical-query-input"]').inputValue()).toBe(testQueries.simple);
    });

    test('should handle concurrent users', async () => {
      // Simulate multiple concurrent sessions
      const contexts = await Promise.all([
        page.context().browser()?.newContext(),
        page.context().browser()?.newContext(),
        page.context().browser()?.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(ctx => ctx?.newPage())
      );
      
      // Navigate all pages simultaneously
      await Promise.all(
        pages.map(p => p?.goto(BASE_URL))
      );
      
      // Verify all pages loaded
      for (const p of pages) {
        if (p) {
          await expect(p.locator('main')).toBeVisible();
        }
      }
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx?.close()));
    });
  });

  test.describe('Security and Data Privacy', () => {
    test('should prevent XSS attacks', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      const xssPayloads = [
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(document.cookie)',
        '<svg onload="alert(1)">'
      ];
      
      for (const payload of xssPayloads) {
        await page.fill('[data-testid="clinical-query-input"]', payload);
        await page.click('[data-testid="submit-query-button"]');
        
        // Should not execute script - check for error message instead
        await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
        
        // Clear the input
        await page.fill('[data-testid="clinical-query-input"]', '');
      }
    });

    test('should secure sensitive data in localStorage', async () => {
      await page.goto(`${BASE_URL}/query`);
      
      // Submit a query with patient data
      await page.click('[data-testid="show-advanced-options"]');
      await page.fill('[data-testid="clinical-query-input"]', testQueries.complex);
      await page.fill('[data-testid="patient-age"]', '65');
      await page.click('[data-testid="submit-query-button"]');
      
      // Check localStorage - sensitive data should not be stored in plain text
      const localStorage = await page.evaluate(() => window.localStorage);
      const sensitiveData = ['password', 'ssn', 'medical-record'];
      
      for (const key of Object.keys(localStorage)) {
        for (const sensitive of sensitiveData) {
          expect(key.toLowerCase()).not.toContain(sensitive);
          expect(localStorage[key].toLowerCase()).not.toContain(sensitive);
        }
      }
    });

    test('should implement proper session management', async () => {
      await page.goto(BASE_URL);
      
      // Check for secure session handling
      const cookies = await page.context().cookies();
      
      for (const cookie of cookies) {
        if (cookie.name.toLowerCase().includes('session')) {
          // Session cookies should be secure
          expect(cookie.httpOnly).toBe(true);
          expect(cookie.secure).toBe(true);
        }
      }
    });
  });

  test.describe('Integration with Backend Services', () => {
    test('should verify backend API health', async () => {
      // Check backend health directly
      const response = await page.request.get(`${API_URL}/health`);
      expect(response.status()).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.services).toBeDefined();
    });

    test('should handle backend service degradation', async () => {
      // Mock degraded service
      await page.route(`${API_URL}/health`, route => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({
            status: 'degraded',
            services: { rag_service: 'error' }
          })
        });
      });
      
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Should show service degradation warning
      await expect(page.locator('[data-testid="service-warning"]')).toBeVisible();
    });

    test('should validate API rate limiting', async () => {
      // Make rapid API requests
      const requests = Array(20).fill(null).map(() => 
        page.request.get(`${API_URL}/info`)
      );
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.some(r => r.status() === 429);
      expect(rateLimited).toBe(true);
    });
  });
});

// Helper functions
async function waitForWebSocketMessage(page: Page, expectedType: string, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        const message = JSON.parse(event.payload.toString());
        if (message.type === expectedType) {
          clearTimeout(timer);
          resolve(message);
        }
      });
    });
  });
}

async function simulateSlowNetwork(page: Page) {
  await page.route('**/*', route => {
    setTimeout(() => route.continue(), 2000);
  });
}

export { };