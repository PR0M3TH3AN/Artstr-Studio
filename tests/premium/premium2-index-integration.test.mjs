import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', '..', 'src', 'index.html');

async function indexHtml() {
  return readFile(indexPath, 'utf8');
}

test('index page wires Premium 2.0 private-copy unlock flow', async () => {
  const html = await indexHtml();

  assert.match(html, /import \* as Premium2 from '\.\/premium2-helpers\.mjs';/);
  assert.match(html, /window\.ArtstrPremium2 = Premium2;/);
  assert.match(html, /async function _publishPurchaseCopyAndBuildVaultItem/);
  assert.match(html, /helpers\.buildPurchaseCopyPlaintext/);
  assert.match(html, /helpers\.buildPurchaseCopyEventDraft/);
  assert.match(html, /helpers\.buildVaultV2Item/);
  assert.match(html, /await _loadPurchaseCopyPayload\(it\.privateCopy\)/);
  assert.match(html, /source: it\.privateCopy \? 'vault-private-copy' : 'vault'/);
  assert.match(html, /Unlocked\. Saving your private purchased copy/);
  assert.match(html, /Private copy saved\. Syncing purchase vault/);
});

test('index page wires admin policy into premium publish stamping', async () => {
  const html = await indexHtml();

  assert.match(html, /async function _loadPremiumPublishPolicy/);
  assert.match(html, /helpers\.validatePremiumPolicyEvent/);
  assert.match(html, /helpers\.buildPremiumPublishStamp/);
  assert.match(html, /NWC\.verifyEvent\(event\)/);
  assert.match(html, /supportedSoftgateEpochs: Premium\.SUPPORTED_EPOCHS/);
  assert.match(html, /const premiumPolicy = await _loadPremiumPublishPolicy\(\)/);
  assert.match(html, /Premium\.encryptPayload\(payload, coord, \{ epoch: premiumPolicy\.stamp\.softgateEpoch \}\)/);
  assert.match(html, /envelope\.premiumMode = premiumPolicy\.stamp\.premiumMode/);
  assert.match(html, /\.\.\.premiumPolicy\.stamp\.tags/);
  assert.match(html, /\['encrypted', premiumPolicy\.stamp\.encryptedTag\]/);
});

test('soft-gate crypto supports the active Premium 2.0 policy epoch', async () => {
  const html = await indexHtml();

  assert.match(html, /'2026-07': \[/);
  assert.match(html, /const CURRENT_EPOCH = '2026-07'/);
});

test('vault item stubs preserve Premium 2.0 private-copy fields', async () => {
  const html = await indexHtml();
  const stubStart = html.indexOf('function _vaultItemStub(item)');
  const stubEnd = html.indexOf('async function _publishVaultEvent', stubStart);
  const stubBody = html.slice(stubStart, stubEnd);

  assert.ok(stubStart > -1, '_vaultItemStub should exist');
  assert.ok(stubEnd > stubStart, '_publishVaultEvent should follow _vaultItemStub');
  assert.match(stubBody, /privateCopy: item\.privateCopy/);
  assert.match(stubBody, /privateCopyEventId: item\.privateCopyEventId/);
  assert.match(stubBody, /claimEpoch: item\.claimEpoch/);
  assert.match(stubBody, /receiptSummary: item\.receiptSummary/);
});
