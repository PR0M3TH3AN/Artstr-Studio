import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildPurchaseCopyEventDraft,
  buildPurchaseCopyCoordinate,
  buildPurchaseCopyPlaintext,
  buildVaultV2Item,
  claimStatus,
  normalizeReceiptEvidence,
  purchaseCopyDTag,
  resolveVaultItem,
  summarizePartialPayment,
  validatePremiumPolicyEvent,
} from '../../src/premium2-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures', 'premium');
const platformPubkey = 'a'.repeat(64);

async function fixture(name) {
  return JSON.parse(await readFile(join(fixturesDir, name), 'utf8'));
}

test('validates admin policy event and rejects untrusted policy shapes', async () => {
  const valid = await fixture('policy-valid-active.json');
  assert.deepEqual(validatePremiumPolicyEvent(valid, { platformPubkey }).ok, true);

  const wrongPubkey = await fixture('policy-wrong-pubkey.json');
  assert.equal(validatePremiumPolicyEvent(wrongPubkey, { platformPubkey }).reason, 'wrong_pubkey');

  const malformed = await fixture('policy-malformed-content.json');
  assert.equal(validatePremiumPolicyEvent(malformed, { platformPubkey }).reason, 'malformed_content');

  const wrongD = { ...valid, tags: [['d', 'attacker-policy']] };
  assert.equal(validatePremiumPolicyEvent(wrongD, { platformPubkey }).reason, 'wrong_d_tag');
});

test('resolves vault v2 private copies before legacy inline payloads', async () => {
  const v2 = await fixture('vault-v2-private-copy-pointer.json');
  assert.deepEqual(resolveVaultItem(v2), {
    state: 'private_copy',
    source: v2.privateCopy,
    item: v2,
  });

  const v1 = await fixture('vault-v1-inline-payload.json');
  const resolved = resolveVaultItem(v1);
  assert.equal(resolved.state, 'legacy_inline_payload');
  assert.equal(resolved.source, v1.a);
  assert.equal(resolved.item.payload.layers[0].text, 'Legacy purchase');

  assert.equal(resolveVaultItem({ a: v1.a }).state, 'missing_private_copy');
});

test('derives deterministic private purchase-copy d-tags from source address', async () => {
  const address = '30078:creatorpubkey:premium:customart:poster';
  const first = await purchaseCopyDTag(address);
  const second = await purchaseCopyDTag(address);
  assert.equal(first, second);
  assert.match(first, /^artstr:purchase-copy:[A-Za-z0-9_-]+$/);
  assert.notEqual(first, await purchaseCopyDTag(`${address}:different`));
});

test('computes claim status without blocking owned or self-authored designs', () => {
  assert.equal(claimStatus({ claimUntil: 100, now: 200 }), 'expired');
  assert.equal(claimStatus({ claimUntil: 100, now: 200, owned: true }), 'owned');
  assert.equal(claimStatus({ claimUntil: 100, now: 200, selfAuthored: true }), 'self_authored');
  assert.equal(claimStatus({ claimUntil: 300, now: 200 }), 'claimable');
  assert.equal(claimStatus({ claimUntil: 300, now: 200, epochState: 'closed' }), 'closed');
});

test('normalizes receipt evidence and totals split-zap sats', () => {
  const evidence = normalizeReceiptEvidence({
    sourceAddress: '30078:creatorpubkey:premium:customart:poster',
    eventId: 'event-v2',
    buyerPubkey: 'buyerpubkey',
    policyEventId: 'policy-event',
    claimEpoch: '2026-07',
    softgateEpoch: '2026-07',
    premiumMode: 'softgate-v1.5',
    receipts: [
      { role: 'creator', recipientPubkey: 'creatorpubkey', amountSats: 700, receiptId: 'r1' },
      { role: 'platform', recipientPubkey: 'platformpubkey', amountSats: 300, receiptId: 'r2' },
    ],
  });
  assert.equal(evidence.totalSats, 1000);
  assert.equal(evidence.receipts.length, 2);
  assert.equal(evidence.claimEpoch, '2026-07');
});

test('summarizes partial payment state and exposes only missing legs', async () => {
  const pending = await fixture('partial-payment-creator-paid.json');
  const summary = summarizePartialPayment(pending.requiredPayments);
  assert.equal(summary.status, 'partial');
  assert.equal(summary.confirmedCount, 1);
  assert.equal(summary.missingCount, 1);
  assert.equal(summary.confirmedSats, 700);
  assert.equal(summary.missingSats, 300);
  assert.equal(summary.missing[0].role, 'platform');
});

test('builds purchase-copy plaintext with source provenance and payload snapshot', async () => {
  const expected = await fixture('purchase-copy-v1.json');
  const actual = buildPurchaseCopyPlaintext({
    source: expected.source,
    purchase: expected.purchase,
    license: expected.license,
    payload: expected.payload,
    payloadSchemaVersion: expected.payloadSchemaVersion,
    createdAt: expected.createdAt,
  });

  assert.deepEqual(actual, expected);
  assert.equal(actual.source.a, '30078:creatorpubkey:premium:customart:poster');
  assert.equal(actual.source.eventId, 'event-v2');
  assert.equal(actual.payload.layers[0].text, 'Purchased copy');
});

test('builds private purchase-copy event drafts without leaking purchase metadata in public tags', async () => {
  const sourceAddress = '30078:creatorpubkey:premium:customart:poster';
  const draft = await buildPurchaseCopyEventDraft({
    sourceAddress,
    encryptedContent: 'nip44-encrypted-payload',
    createdAt: 1783200000,
  });

  assert.equal(draft.kind, 30078);
  assert.equal(draft.created_at, 1783200000);
  assert.equal(draft.content, 'nip44-encrypted-payload');

  const publicTags = JSON.stringify(draft.tags);
  assert.match(publicTags, /artstr:purchase-copy:/);
  assert.doesNotMatch(publicTags, /Poster Template/);
  assert.doesNotMatch(publicTags, /creatorpubkey/);
  assert.doesNotMatch(publicTags, /1000/);
  assert.doesNotMatch(publicTags, /premium:customart:poster/);
});

test('builds vault v2 pointers that summarize receipts without embedding payload', async () => {
  const copy = await fixture('purchase-copy-v1.json');
  const privateCopy = await buildPurchaseCopyCoordinate({
    buyerPubkey: copy.purchase.buyerPubkey,
    sourceAddress: copy.source.a,
  });
  const item = buildVaultV2Item({
    source: copy.source,
    privateCopy,
    privateCopyEventId: 'copy-event-v2',
    purchase: copy.purchase,
    mode: 'customart',
    licenseType: copy.license.type,
  });

  assert.equal(item.schema, 'purchase-vault-v2');
  assert.equal(item.a, copy.source.a);
  assert.equal(item.eventId, copy.source.eventId);
  assert.equal(item.privateCopy, privateCopy);
  assert.equal(item.receiptSummary.requiredCount, 2);
  assert.equal(item.receiptSummary.confirmedCount, 2);
  assert.equal(item.receiptSummary.totalSats, 1000);
  assert.equal('payload' in item, false);
});
