/**
 * Global teardown for Playwright E2E tests
 * Cleans up test environment and generates reports
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting CDSS E2E Test Environment Teardown...');

  try {
    // Generate test summary report
    console.log('📊 Generating test summary report...');
    
    const testResultsDir = path.join(__dirname, 'test-results');
    const reportPath = path.join(testResultsDir, 'test-summary.md');
    
    const timestamp = new Date().toISOString();
    
    // Check if results.json exists
    let testResults = null;
    try {
      const resultsPath = path.join(testResultsDir, 'results.json');
      const resultsData = await fs.readFile(resultsPath, 'utf-8');
      testResults = JSON.parse(resultsData);
    } catch (error) {
      console.log('⚠️  No test results found, skipping detailed report');
    }

    // Create summary report
    let report = `# CDSS E2E Test Summary\n\n`;
    report += `**Test Run:** ${timestamp}\n`;
    report += `**Configuration:** ${process.env.NODE_ENV || 'development'}\n\n`;

    if (testResults) {
      const stats = testResults.stats || {};
      const suites = testResults.suites || [];
      
      report += `## Test Statistics\n\n`;
      report += `- **Total Tests:** ${stats.total || 0}\n`;
      report += `- **Passed:** ${stats.passed || 0}\n`;
      report += `- **Failed:** ${stats.failed || 0}\n`;
      report += `- **Skipped:** ${stats.skipped || 0}\n`;
      report += `- **Duration:** ${stats.duration ? Math.round(stats.duration / 1000) : 0}s\n\n`;

      // Success rate
      const successRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
      report += `**Success Rate:** ${successRate}%\n\n`;

      // Test suite breakdown
      report += `## Test Suite Results\n\n`;
      for (const suite of suites) {
        report += `### ${suite.title}\n`;
        if (suite.tests) {
          for (const test of suite.tests) {
            const status = test.results?.[0]?.status === 'passed' ? '✅' : '❌';
            const duration = test.results?.[0]?.duration ? Math.round(test.results[0].duration / 1000) : 0;
            report += `- ${status} ${test.title} (${duration}s)\n`;
          }
        }
        report += '\n';
      }

      // Failed tests details
      const failedTests = [];
      for (const suite of suites) {
        if (suite.tests) {
          for (const test of suite.tests) {
            if (test.results?.[0]?.status === 'failed') {
              failedTests.push({
                suite: suite.title,
                test: test.title,
                error: test.results[0].error?.message || 'Unknown error'
              });
            }
          }
        }
      }

      if (failedTests.length > 0) {
        report += `## Failed Tests\n\n`;
        for (const failed of failedTests) {
          report += `### ${failed.suite}: ${failed.test}\n`;
          report += `**Error:** ${failed.error}\n\n`;
        }
      }
    }

    // Environment information
    report += `## Environment Information\n\n`;
    report += `- **Node Version:** ${process.version}\n`;
    report += `- **Platform:** ${process.platform}\n`;
    report += `- **Architecture:** ${process.arch}\n`;
    report += `- **CI:** ${process.env.CI ? 'Yes' : 'No'}\n\n`;

    // Recommendations
    report += `## Recommendations\n\n`;
    if (testResults?.stats?.failed > 0) {
      report += `- ⚠️  ${testResults.stats.failed} test(s) failed. Review failure details above.\n`;
    }
    if (testResults?.stats && testResults.stats.total > 0) {
      const successRate = (testResults.stats.passed / testResults.stats.total) * 100;
      if (successRate < 95) {
        report += `- ⚠️  Success rate is ${successRate.toFixed(1)}%. Consider investigating flaky tests.\n`;
      }
    }
    
    report += `- 📊 Check detailed HTML report for more information.\n`;
    report += `- 📹 Review video recordings for failed tests.\n`;
    report += `- 🖼️  Check screenshots for visual verification.\n\n`;

    // Write summary report
    await fs.writeFile(reportPath, report);
    console.log(`✅ Test summary report generated: ${reportPath}`);

    // Clean up temporary files
    console.log('🧹 Cleaning up temporary test files...');
    
    const tempDirs = [
      path.join(testResultsDir, 'tmp'),
      path.join(__dirname, 'test-data', 'temp')
    ];
    
    for (const tempDir of tempDirs) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`✅ Cleaned up: ${tempDir}`);
      } catch (error) {
        // Ignore errors for non-existent directories
      }
    }

    // Archive test artifacts (if in CI)
    if (process.env.CI) {
      console.log('📦 Archiving test artifacts for CI...');
      
      // Create archive info file
      const archiveInfo = {
        timestamp,
        testResults: testResults?.stats || {},
        environment: {
          node: process.version,
          platform: process.platform,
          ci: true
        }
      };
      
      await fs.writeFile(
        path.join(testResultsDir, 'archive-info.json'),
        JSON.stringify(archiveInfo, null, 2)
      );
      
      console.log('✅ Test artifacts archived');
    }

    // Performance metrics
    console.log('📊 Performance metrics summary...');
    
    // Check for large test artifacts
    const checkDir = async (dir: string, name: string) => {
      try {
        const stats = await fs.stat(dir);
        if (stats.isDirectory()) {
          const files = await fs.readdir(dir);
          const totalSize = await files.reduce(async (acc, file) => {
            const filePath = path.join(dir, file);
            const fileStats = await fs.stat(filePath);
            return (await acc) + fileStats.size;
          }, Promise.resolve(0));
          
          console.log(`  • ${name}: ${files.length} files, ${Math.round(totalSize / 1024 / 1024)}MB`);
        }
      } catch (error) {
        // Directory doesn't exist
      }
    };

    await checkDir(path.join(testResultsDir, 'screenshots'), 'Screenshots');
    await checkDir(path.join(testResultsDir, 'videos'), 'Videos');
    await checkDir(path.join(testResultsDir, 'traces'), 'Traces');

    console.log('🎉 CDSS E2E Test Environment Teardown Complete!');
    
    // Final status
    if (testResults?.stats?.failed > 0) {
      console.log(`❌ ${testResults.stats.failed} test(s) failed`);
      console.log('📋 Check the test summary report for details');
    } else {
      console.log('✅ All tests completed successfully');
    }

  } catch (error) {
    console.error('❌ Teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

export default globalTeardown;