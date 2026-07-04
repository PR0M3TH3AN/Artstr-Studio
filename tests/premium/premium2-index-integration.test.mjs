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

test('index page exposes admin-only premium policy publishing controls', async () => {
  const html = await indexHtml();

  assert.match(html, /id="premiumPolicyAdminDetails"/);
  assert.match(html, /id="premiumPolicyPublishBtn"/);
  assert.match(html, /function isPremiumPolicyAdmin\(\)/);
  assert.match(html, /normalizePubkey\(state\.community\.myPubkey\) === normalizePubkey\(platform\.getPubkeyHex\(\)\)/);
  assert.match(html, /function buildPremiumPolicyFromAdminForm\(\)/);
  assert.match(html, /async function publishPremiumPolicyFromSettings\(\)/);
  assert.match(html, /helpers\.buildPremiumPolicyEventDraft\(policy\)/);
  assert.match(html, /helpers\.validatePremiumPolicyEvent\(signed, \{ platformPubkey: platform\.getPubkeyHex\(\) \}\)/);
  assert.match(html, /on\('premiumPolicyPublishBtn', 'click'/);
  assert.match(html, /Premium policy published/);
});

test('soft-gate crypto supports the active Premium 2.0 policy epoch', async () => {
  const html = await indexHtml();

  assert.match(html, /'2026-07': \[/);
  assert.match(html, /const CURRENT_EPOCH = '2026-07'/);
});

test('index page blocks expired first-time premium claims but keeps owned paths separate', async () => {
  const html = await indexHtml();

  assert.match(html, /function _premiumClaimUntil\(row\)/);
  assert.match(html, /function _premiumClaimStatusForRow\(row\)/);
  assert.match(html, /owned: !!\(row\?\.zapGate\?\.unlocked \|\| isUnlockedLocally\(row\?\.e\?\.id, address\)\)/);
  assert.match(html, /const claimState = _premiumClaimStatusForRow\(row\);\n\s+if \(claimState === 'expired' \|\| claimState === 'closed'\)/);
  assert.match(html, /This premium design is no longer claimable from the public storefront/);
  assert.match(html, /btn\.textContent = 'Claim period ended'/);
  assert.match(html, /forkBtn\.textContent = 'Claim period ended'/);
  assert.match(html, /Purchased private copies still open from the vault/);
});

test('index page persists and retries failed Premium 2.0 private-copy saves', async () => {
  const html = await indexHtml();

  assert.match(html, /const PENDING_PRIVATE_COPY_KEY = 'casewrap-pending-private-copies-v1'/);
  assert.match(html, /function savePendingPrivateCopy/);
  assert.match(html, /function clearPendingPrivateCopy/);
  assert.match(html, /async function retryPendingVaultWrites/);
  assert.match(html, /savePendingPrivateCopy\(\{\n\s+row,/);
  assert.match(html, /clearPendingPrivateCopy\(row\)/);
  assert.match(html, /source: 'pending-private-copy-retry'/);
  assert.match(html, /Retry saving private copy/);
  assert.match(html, /await retryPendingVaultWrites\(\{ silent: false \}\)/);
  assert.match(html, /Use Purchased → Retry saving private copy when relay sync recovers/);
});

test('index page exposes partial-payment resume state without discarding paid legs', async () => {
  const html = await indexHtml();

  assert.match(html, /function partialUnlockSummary\(eventId\)/);
  assert.match(html, /function partialUnlockActionLabel\(eventId, amountSats\)/);
  assert.match(html, /Resume payment \(\$\{summary\.missing\} left\)/);
  assert.match(html, /Artstr will reuse cached invoices\/preimages and only pay missing legs/);
  assert.match(html, /btn\.textContent = partialUnlockActionLabel\(row\.e\?\.id, row\.zapGate\.min\)/);
  assert.match(html, /forkBtn\.textContent = partialUnlockActionLabel\(row\.e\?\.id, row\.zapGate\?\.min \|\| 100\)/);
  assert.match(html, /function clearStalePartialUnlocks/);
  assert.match(html, /if \(partial\?\.creator\?\.preimage \|\| partial\?\.platform\?\.preimage\) continue/);
  assert.match(html, /const stalePartialCleared = clearStalePartialUnlocks\(\)/);
});

test('index page recovers NWC split-zap legs after wallet timeouts', async () => {
  const html = await indexHtml();

  assert.match(html, /const NWC_PAY_INVOICE_TIMEOUT_MS = 60000/);
  assert.match(html, /return _request\('pay_invoice', \{ invoice: bolt11 \}, \{ timeoutMs: opts\.timeoutMs \|\| NWC_PAY_INVOICE_TIMEOUT_MS \}\)/);
  assert.ok(html.includes('const params = /^ln/i.test(value) ? { invoice: value } : { payment_hash: value };'));
  assert.match(html, /const postTimeoutLookup = await nwc\.lookupInvoice\(leg\.bolt11\)/);
  assert.match(html, /if \(postTimeoutLookup\?\.preimage\)/);
  assert.match(html, /preimage: postTimeoutLookup\.preimage/);
  assert.match(html, /If one payment leg completed, click Resume payment/);
});

test('index page refreshes creator Lightning metadata before premium unlock payment', async () => {
  const html = await indexHtml();

  assert.ok(html.includes('let authorProfile = _feedCache.profiles?.[row.e?.pubkey]'));
  assert.ok(html.includes('|| state.community?.profiles?.[row.e?.pubkey]'));
  assert.match(html, /if \(!resolveLnurlPayUrl\(authorProfile\)\)/);
  assert.match(html, /authorProfile = await ensureProfilePageData\(row\.e\.pubkey/);
  assert.match(html, /Checking creator Lightning address/);
  assert.match(html, /lud06: authorProfile\?\.lud06/);
});

test('index page migrates legacy inline vault purchases to private copies', async () => {
  const html = await indexHtml();

  assert.match(html, /function _rowFromLegacyVaultItem\(item\)/);
  assert.match(html, /async function migrateLegacyVaultPrivateCopies/);
  assert.match(html, /item\?\.payload && !item\.privateCopy && item\.a && item\.eventId/);
  assert.match(html, /migratedFrom: item\.schema \|\| 'purchase-vault-v1-inline-payload'/);
  assert.match(html, /source: 'vault-legacy-migrated-private-copy'/);
  assert.match(html, /const legacyCount = \(items \|\| \[\]\)\.filter\(\(item\) => item\?\.payload && !item\.privateCopy\)\.length/);
  assert.match(html, /migrateBtn\.textContent = 'Save private copies'/);
  assert.match(html, /await migrateLegacyVaultPrivateCopies\(\{ silent: false \}\)/);
});

test('index page exposes Premium 2.0 purchase repair workflow', async () => {
  const html = await indexHtml();

  assert.match(html, /async function repairPremiumPurchases/);
  assert.match(html, /const pending = await retryPendingVaultWrites\(\{ silent: true \}\)/);
  assert.match(html, /const migrated = await migrateLegacyVaultPrivateCopies\(\{ silent: true \}\)/);
  assert.match(html, /await _loadPurchaseCopyPayload\(item\.privateCopy\)/);
  assert.match(html, /status = pending\.failed \|\| migrated\.failed \|\| unrecoverable \? 'needs_attention' : missing \? 'repairable' : 'clean'/);
  assert.match(html, /repairBtn\.textContent = 'Repair purchases'/);
  assert.match(html, /const result = await repairPremiumPurchases\(\{ silent: false \}\)/);
  assert.match(html, /Purchase repair found everything clean/);
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
