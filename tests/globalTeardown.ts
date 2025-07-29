/**
 * Global Jest teardown - runs once after all tests complete
 * Used for cleanup and final reporting
 */

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any global resources
  // (Add specific cleanup logic if needed)
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Test environment cleanup complete');
}