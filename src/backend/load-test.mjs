import autocannon from 'autocannon';
import { createBackend } from './app.mjs';

async function runLoadTest() {
  console.log('Starting backend server for load test...');
  const port = 3001; // Use a separate port to avoid port collision
  const backend = await createBackend({
    storage: ':memory:',
    syncOptions: { force: true },
    seed: true
  });
  
  const server = backend.app.listen(port, () => {
    console.log(`Test server listening on port ${port}`);
  });

  console.log('Running load test against GET /wishlist...');
  try {
    const result = await autocannon({
      url: `http://localhost:${port}/wishlist`,
      connections: 10, // 10 concurrent users
      pipelining: 1,
      duration: 5,     // Run for 5 seconds
    });
    
    console.log('\n======================================');
    console.log('📊 LOAD TEST RESULT SUMMARY');
    console.log('======================================');
    console.log(`Total Requests:      ${result.requests.total}`);
    console.log(`Requests/Sec:        ${result.requests.average}`);
    console.log(`Average Latency:     ${result.latency.average} ms`);
    console.log(`Max Latency:         ${result.latency.max} ms`);
    console.log(`Total Bytes Sent:    ${result.throughput.total} bytes`);
    console.log(`Errors/Timeouts:     ${result.errors}`);
    console.log('======================================\n');
    
    if (result.errors > 0) {
      console.warn(`Warning: Encountered ${result.errors} errors during the load test.`);
    }
  } catch (error) {
    console.error('Error running load test:', error);
  } finally {
    console.log('Stopping test server...');
    server.close(() => {
      console.log('Test server stopped.');
      process.exit(0);
    });
  }
}

runLoadTest();
