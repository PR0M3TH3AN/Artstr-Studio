import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildPurchaseCopyCoordinate,
  buildPurchaseCopyEventDraft,
  buildPurchaseCopyPlaintext,
  buildVaultV2Item,
  resolveVaultItem,
  tagValue,
} from '../../src/premium2-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures', 'premium');

async function fixture(name) {
  return JSON.parse(await readFile(join(fixturesDir, name), 'utf8'));
}

function fakeEncryptJson(value) {
  return `fake-nip44:${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`;
}

function fakeDecryptJson(content) {
  assert.match(content, /^fake-nip44:/);
  return JSON.parse(Buffer.from(content.slice('fake-nip44:'.length), 'base64url').toString('utf8'));
}

function coordinateForEvent(event) {
  return `${event.kind}:${event.pubkey}:${tagValue(event, 'd')}`;
}

class FakeRelay {
  eventsByCoordinate = new Map();

  publish(event) {
    this.eventsByCoordinate.set(coordinateForEvent(event), event);
    return event;
  }

  getByCoordinate(coord) {
    return this.eventsByCoordinate.get(coord) || null;
  }
}

test('fake relay restores a purchase from vault v2 pointer to private copy', async () => {
  const relay = new FakeRelay();
  const copyFixture = await fixture('purchase-copy-v1.json');
  const privateCopyCoord = await buildPurchaseCopyCoordinate({
    buyerPubkey: copyFixture.purchase.buyerPubkey,
    sourceAddress: copyFixture.source.a,
  });

  const purchaseCopyPlaintext = buildPurchaseCopyPlaintext({
    source: copyFixture.source,
    purchase: copyFixture.purchase,
    license: copyFixture.license,
    payload: copyFixture.payload,
    payloadSchemaVersion: copyFixture.payloadSchemaVersion,
    createdAt: copyFixture.createdAt,
  });
  const purchaseCopyDraft = await buildPurchaseCopyEventDraft({
    sourceAddress: copyFixture.source.a,
    encryptedContent: fakeEncryptJson(purchaseCopyPlaintext),
    createdAt: copyFixture.createdAt,
  });
  const signedPrivateCopy = {
    ...purchaseCopyDraft,
    id: 'copy-event-v2',
    pubkey: copyFixture.purchase.buyerPubkey,
  };
  relay.publish(signedPrivateCopy);

  const vaultItem = buildVaultV2Item({
    source: copyFixture.source,
    privateCopy: privateCopyCoord,
    privateCopyEventId: signedPrivateCopy.id,
    purchase: copyFixture.purchase,
    mode: 'customart',
    licenseType: copyFixture.license.type,
  });

  // Simulate cache wipe: the only durable state we keep is the vault item
  // and the relay-published encrypted private copy.
  const resolved = resolveVaultItem(vaultItem);
  assert.equal(resolved.state, 'private_copy');
  const restoredEvent = relay.getByCoordinate(resolved.source);
  assert.ok(restoredEvent);
  assert.equal(JSON.stringify(restoredEvent.tags).includes(copyFixture.source.a), false);

  const restoredCopy = fakeDecryptJson(restoredEvent.content);
  assert.deepEqual(restoredCopy.payload, copyFixture.payload);
  assert.equal(restoredCopy.source.a, copyFixture.source.a);
  assert.equal(restoredCopy.source.eventId, copyFixture.source.eventId);
  assert.equal(restoredCopy.purchase.amountSats, 1000);
});

