import fs from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load environment variables from .env.local and .env
loadEnvConfig(process.cwd());

interface ResourceItem {
  skill_slug: string;
  title: string;
  url: string;
  type: string;
  level_min: number;
  level_max: number;
  language: string;
  verified: boolean;
}

async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Try HEAD first, fall back to GET if 405 Method Not Allowed or similar
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': userAgent },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (res.status === 405 || res.status === 403 || res.status === 400) {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 10000);

      res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': userAgent },
        signal: getController.signal,
        redirect: 'follow',
      });

      clearTimeout(getTimeout);
    }

    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }

    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch {
    // Try GET fallback on error as some servers reject HEAD completely
    try {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 10000);

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': userAgent },
        signal: getController.signal,
        redirect: 'follow',
      });

      clearTimeout(getTimeout);

      if (res.status >= 200 && res.status < 400) {
        return { ok: true, status: res.status };
      }

      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    } catch (fallbackErr: unknown) {
      return {
        ok: false,
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      };
    }
  }
}

async function main() {
  const filePath = path.join(process.cwd(), 'data', 'seed', 'resources.json');
  if (!fs.existsSync(filePath)) {
    console.error(`Resources file not found at: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const resources: ResourceItem[] = JSON.parse(raw);

  console.log(`Verifying ${resources.length} resource URLs...\n`);

  let failedCount = 0;

  for (const item of resources) {
    process.stdout.write(`Checking [${item.skill_slug}] ${item.title} (${item.url})... `);
    const result = await checkUrl(item.url);

    if (result.ok) {
      console.log(`✓ OK (${result.status})`);
    } else {
      console.log(`✗ FAILED: ${result.error || 'Unknown error'}`);
      failedCount++;
    }
  }

  console.log('\n----------------------------------------');
  if (failedCount > 0) {
    console.error(`URL verification failed: ${failedCount} of ${resources.length} URLs unreachable.`);
    process.exit(1);
  } else {
    console.log(`All ${resources.length} resource URLs verified successfully!`);
    process.exit(0);
  }
}

main();
