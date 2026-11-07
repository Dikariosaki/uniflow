import { loadEnvFile } from 'node:process';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

loadEnvFile(new URL('./.env', import.meta.url));
assert.equal(process.env.SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(process.env.APP_PUBLIC_URL, 'http://localhost:8088');
assert.equal(process.env.VERIFICATION_COMPOSE_PROJECT, 'uniflow-verification');

// The final acceptance scenario exhausts the public rate limiter deliberately.
// Restart only this isolated API so consecutive suite runs start with fresh limits.
execFileSync('docker', ['restart', 'uniflow-verification-api-1'], { stdio: 'pipe' });
const deadline = Date.now() + 30000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://localhost:8088/api/v1/health', { signal: AbortSignal.timeout(2000) });
    if (response.ok && (await response.json()).database === 'connected') { ready = true; break; }
  } catch { /* The API is starting; the web proxy may briefly return 502. */ }
  await new Promise(resolve => setTimeout(resolve, 250));
}
assert.ok(ready, 'Isolated API did not become ready after restart.');
console.log('Isolated API ready; rate limiter reset before the acceptance suite.');
