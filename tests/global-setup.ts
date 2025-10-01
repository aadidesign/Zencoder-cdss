/**
 * Global setup for Playwright E2E tests
 * Prepares test environment and services
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting CDSS E2E Test Environment Setup...');

  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for services to be ready
    console.log('⏳ Waiting for backend services...');
    
    const maxRetries = 30;
    let retries = 0;
    let backendReady = false;
    
    while (retries < maxRetries && !backendReady) {
      try {
        const response = await page.request.get('http://localhost:8000/health');
        if (response.status() === 200) {
          const health = await response.json();
          if (health.status === 'healthy') {
            backendReady = true;
            console.log('✅ Backend services are healthy');
          }
        }
      } catch (error) {
        // Service not ready yet
      }
      
      if (!backendReady) {
        retries++;
        console.log(`⏳ Backend not ready, retrying... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!backendReady) {
      throw new Error('Backend services failed to become healthy within timeout period');
    }

    // Wait for frontend to be ready
    console.log('⏳ Waiting for frontend...');
    let frontendReady = false;
    retries = 0;

    while (retries < maxRetries && !frontendReady) {
      try {
        const response = await page.goto('http://localhost:3000', { timeout: 10000 });
        if (response?.status() === 200) {
          frontendReady = true;
          console.log('✅ Frontend is ready');
        }
      } catch (error) {
        // Frontend not ready yet
      }

      if (!frontendReady) {
        retries++;
        console.log(`⏳ Frontend not ready, retrying... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (!frontendReady) {
      throw new Error('Frontend failed to become ready within timeout period');
    }

    // Verify WebSocket connectivity
    console.log('⏳ Testing WebSocket connectivity...');
    try {
      // This is a basic connectivity test
      await page.evaluate(() => {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket('ws://localhost:8000/ws/test_setup_client');
          
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          
          ws.onerror = () => {
            reject(new Error('WebSocket connection failed'));
          };
          
          // Timeout after 10 seconds
          setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }, 10000);
        });
      });
      console.log('✅ WebSocket connectivity verified');
    } catch (error) {
      console.warn('⚠️  WebSocket test failed:', error);
      // Don't fail setup for WebSocket issues as they might be environment-specific
    }

    // Create test data directories
    console.log('📁 Creating test data directories...');
    const fs = require('fs').promises;
    const path = require('path');
    
    const testDataDir = path.join(__dirname, 'test-data');
    const screenshotsDir = path.join(__dirname, 'test-results', 'screenshots');
    const videosDir = path.join(__dirname, 'test-results', 'videos');
    
    await fs.mkdir(testDataDir, { recursive: true });
    await fs.mkdir(screenshotsDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });
    
    console.log('✅ Test data directories created');

    // Pre-populate test data
    console.log('📝 Setting up test data...');
    const testData = {
      clinicalQueries: [
        "What are the symptoms of diabetes?",
        "Treatment options for hypertension in elderly patients",
        "Diagnostic criteria for acute myocardial infarction"
      ],
      patientProfiles: [
        {
          age: 65,
          gender: "male",
          conditions: ["hypertension", "diabetes"],
          medications: ["metformin", "lisinopril"]
        },
        {
          age: 45,
          gender: "female", 
          conditions: ["asthma"],
          medications: ["albuterol"]
        }
      ]
    };
    
    await fs.writeFile(
      path.join(testDataDir, 'test-data.json'),
      JSON.stringify(testData, null, 2)
    );
    
    console.log('✅ Test data prepared');

    // Verify system performance baseline
    console.log('📊 Establishing performance baseline...');
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000');
    await page.waitForSelector('main', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`✅ Frontend load time: ${loadTime}ms`);
    
    if (loadTime > 5000) {
      console.warn(`⚠️  Slow frontend load time: ${loadTime}ms`);
    }

    console.log('🎉 CDSS E2E Test Environment Setup Complete!');
    console.log('📋 Environment Status:');
    console.log('  • Backend: Ready');
    console.log('  • Frontend: Ready');
    console.log('  • WebSocket: Tested');
    console.log('  • Test Data: Prepared');
    console.log('  • Performance: Baselined');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;