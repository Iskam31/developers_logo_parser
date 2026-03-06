import { parseLogos, closeBrowser } from './lib';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node cli.ts <url> [url2 ...]');
    console.log('Example: npx ts-node cli.ts https://pik.ru/');
    process.exit(1);
  }

  const urls = args.map(arg => {
    let url = arg.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    if (!url.endsWith('/')) url += '/';
    return url;
  });

  console.log(`[INFO] Parsing ${urls.length} site(s)`);
  const results = await parseLogos(urls);
  await closeBrowser();

  console.log('\n' + '═'.repeat(80));
  console.log(`Total: ${results.length} | Success: ${results.filter(r => r.status === 'success').length} | Error: ${results.filter(r => r.status === 'error').length}`);
  console.log('├' + '─'.repeat(32) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(20));
  for (const r of results) {
    const status = r.status === 'success' ? '✅' : '❌';
    const size = r.entry?.width && r.entry?.height ? `${r.entry.width}x${r.entry.height}` : (r.error || '-');
    console.log(`│ ${r.domain.padEnd(30)}│ ${status} ${r.status.padEnd(9)}│ ${size}`);
  }
  console.log('═'.repeat(80));
}

main().catch(e => { console.error(e); process.exit(1); });
