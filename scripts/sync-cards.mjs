import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.APPS_SCRIPT_URL;
if (!base?.startsWith('https://script.google.com/macros/s/')) {
  throw new Error('APPS_SCRIPT_URL must be the public Apps Script /exec URL');
}
const result = {};
for (const action of ['status', 'cards', 'offers', 'merchants']) {
  const url = new URL(base);
  url.searchParams.set('action', action);
  url.searchParams.set('callback', 'syncCardData');
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(action + ': HTTP ' + response.status);
  const raw = (await response.text()).trim();
  const match = /^syncCardData\(([\s\S]*)\);?$/.exec(raw);
  if (!match) throw new Error(action + ': expected JSONP response, got ' + raw.slice(0, 100));
  const data = JSON.parse(match[1].replace(/;$/, ''));
  if (!data.ok) throw new Error(action + ': ' + (data.error || 'API returned an error'));
  result[action] = data;
}
if (!Array.isArray(result.cards.data) || !Array.isArray(result.offers.data) ||
    !Array.isArray(result.merchants.data)) throw new Error('Unexpected data types');
const document = {
  syncedAt: new Date().toISOString(),
  backendVersion: result.status.version ?? '',
  cards: result.cards.data,
  offers: result.offers.data,
  merchants: result.merchants.data
};
await mkdir('data', {recursive:true});
await writeFile('data/creditcards.json', JSON.stringify(document, null, 2) + '\n');
console.log('Synced cards:', document.cards.length, 'offers:', document.offers.length, 'merchants:', document.merchants.length);
