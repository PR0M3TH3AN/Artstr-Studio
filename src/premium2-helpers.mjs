export const PREMIUM_POLICY_D_TAG = 'artstr:premium-policy:v1';
export const PURCHASE_COPY_PREFIX = 'artstr:purchase-copy:';
export const PREMIUM_MODE_V15 = 'softgate-v1.5';
export const PRIVATE_SNAPSHOT_ACTION = 'private-snapshot-required';

export function tagValue(event, name) {
  const tag = (event?.tags || []).find((t) => Array.isArray(t) && t[0] === name);
  return tag ? tag[1] || '' : '';
}

export function validatePremiumPolicyEvent(event, { platformPubkey } = {}) {
  if (!event || typeof event !== 'object') {
    return { ok: false, reason: 'missing_event' };
  }
  if (event.kind !== 30078) {
    return { ok: false, reason: 'wrong_kind' };
  }
  if (!platformPubkey || event.pubkey !== platformPubkey) {
    return { ok: false, reason: 'wrong_pubkey' };
  }
  if (tagValue(event, 'd') !== PREMIUM_POLICY_D_TAG) {
    return { ok: false, reason: 'wrong_d_tag' };
  }
  let policy;
  try {
    policy = JSON.parse(event.content || '');
  } catch {
    return { ok: false, reason: 'malformed_content' };
  }
  if (!policy || typeof policy !== 'object' || policy.v !== 1) {
    return { ok: false, reason: 'unsupported_version' };
  }
  if (!policy.activeSoftgateEpoch || !policy.activeClaimEpoch || !policy.epochs) {
    return { ok: false, reason: 'missing_required_fields' };
  }
  return { ok: true, policy };
}

export function buildPremiumPublishStamp(policy, {
  now = Math.floor(Date.now() / 1000),
  supportedSoftgateEpochs = [],
} = {}) {
  if (!policy || typeof policy !== 'object' || policy.v !== 1) {
    throw new TypeError('Premium policy v1 is required.');
  }
  const softgateEpoch = policy.activeSoftgateEpoch || '';
  const claimEpoch = policy.activeClaimEpoch || '';
  const epochConfig = policy.epochs?.[softgateEpoch];
  if (!softgateEpoch || !claimEpoch || !epochConfig) {
    throw new Error('Premium policy is missing the active epoch configuration.');
  }
  if (epochConfig.status === 'closed') {
    throw new Error(`Premium policy epoch ${softgateEpoch} is closed for new publishes.`);
  }
  if (supportedSoftgateEpochs.length && !supportedSoftgateEpochs.includes(softgateEpoch)) {
    throw new Error(`Premium policy epoch ${softgateEpoch} is not supported by this client.`);
  }
  const minDays = Math.max(1, Number(policy.minClaimDays) || 1);
  const maxDays = Math.max(minDays, Number(policy.maxClaimDays) || 180);
  const requestedDays = Number(policy.defaultClaimDays) || 90;
  const claimDays = Math.min(maxDays, Math.max(minDays, requestedDays));
  const claimUntil = Number(now) + (claimDays * 86400);
  const premiumMode = PREMIUM_MODE_V15;
  const postPurchaseAction = PRIVATE_SNAPSHOT_ACTION;
  return {
    premiumMode,
    softgateEpoch,
    claimEpoch,
    claimUntil,
    claimDays,
    postPurchaseAction,
    encryptedTag: epochConfig.softgateKdf || 'artstr-softgate-v1.5',
    tags: [
      ['premium-mode', premiumMode],
      ['softgate-epoch', softgateEpoch],
      ['claim-epoch', claimEpoch],
      ['claim-until', String(claimUntil)],
      ['claim-policy', postPurchaseAction],
      ['post-purchase-action', postPurchaseAction],
    ],
    envelopeSoftgate: {
      claimEpoch,
      claimUntil,
      postPurchaseAction,
    },
  };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function purchaseCopyDTag(addressCoord) {
  if (!addressCoord || typeof addressCoord !== 'string') {
    throw new TypeError('addressCoord is required');
  }
  const digestBytes = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(addressCoord),
  ));
  const digest = bytesToBase64Url(digestBytes);
  return `${PURCHASE_COPY_PREFIX}${digest}`;
}

export async function buildPurchaseCopyCoordinate({ buyerPubkey, sourceAddress } = {}) {
  if (!buyerPubkey || typeof buyerPubkey !== 'string') {
    throw new TypeError('buyerPubkey is required');
  }
  return `30078:${buyerPubkey}:${await purchaseCopyDTag(sourceAddress)}`;
}

export function buildPurchaseCopyPlaintext({
  source,
  purchase,
  license,
  payload,
  payloadSchemaVersion = 5,
  createdAt = Math.floor(Date.now() / 1000),
} = {}) {
  if (!source?.a) throw new TypeError('source.a is required');
  if (!purchase?.buyerPubkey) throw new TypeError('purchase.buyerPubkey is required');
  if (!payload || typeof payload !== 'object') throw new TypeError('payload object is required');
  return {
    v: 1,
    kind: 'artstr-purchase-copy',
    createdAt,
    source: {
      a: source.a || '',
      eventId: source.eventId || '',
      creatorPubkey: source.creatorPubkey || '',
      title: source.title || '',
      premiumMode: source.premiumMode || '',
      softgateEpoch: source.softgateEpoch || '',
      claimEpoch: source.claimEpoch || '',
    },
    purchase: {
      buyerPubkey: purchase.buyerPubkey || '',
      amountSats: Number(purchase.amountSats) || 0,
      unlockedAt: Number(purchase.unlockedAt) || createdAt,
      receipts: (purchase.receipts || []).map((r) => ({
        role: r.role || '',
        recipientPubkey: r.recipientPubkey || '',
        amountSats: Number(r.amountSats) || 0,
        receiptId: r.receiptId || '',
        preimage: r.preimage || '',
      })),
    },
    license: {
      type: license?.type || 'personal-use-template',
      snapshot: license?.snapshot !== false,
      sourceCanChange: license?.sourceCanChange !== false,
    },
    payloadSchemaVersion,
    payload,
  };
}

export async function buildPurchaseCopyEventDraft({
  sourceAddress,
  encryptedContent,
  createdAt = Math.floor(Date.now() / 1000),
} = {}) {
  if (!sourceAddress) throw new TypeError('sourceAddress is required');
  if (!encryptedContent || typeof encryptedContent !== 'string') {
    throw new TypeError('encryptedContent is required');
  }
  return {
    kind: 30078,
    created_at: createdAt,
    tags: [
      ['d', await purchaseCopyDTag(sourceAddress)],
      ['client', 'Artstr Studio'],
      ['encrypted', 'nip44'],
      ['t', 'casewrap-purchase-copy'],
      ['purchase-copy', 'true'],
    ],
    content: encryptedContent,
  };
}

export function buildVaultV2Item({
  source,
  privateCopy,
  privateCopyEventId = '',
  purchase,
  mode = '',
  licenseType = 'personal-use-template',
} = {}) {
  if (!source?.a) throw new TypeError('source.a is required');
  if (!privateCopy) throw new TypeError('privateCopy is required');
  const receipts = purchase?.receipts || [];
  return {
    schema: 'purchase-vault-v2',
    a: source.a || '',
    eventId: source.eventId || '',
    privateCopy,
    privateCopyEventId,
    creatorPubkey: source.creatorPubkey || '',
    title: source.title || '',
    mode,
    unlockedAt: Number(purchase?.unlockedAt) || Date.now(),
    amountSats: Number(purchase?.amountSats) || 0,
    claimEpoch: source.claimEpoch || '',
    softgateEpoch: source.softgateEpoch || '',
    licenseType,
    receiptSummary: {
      requiredCount: receipts.length,
      confirmedCount: receipts.filter((r) => r.receiptId || r.preimage).length,
      totalSats: receipts.reduce((sum, r) => sum + (Number(r.amountSats) || 0), 0),
    },
  };
}

export function resolveVaultItem(item) {
  if (!item || typeof item !== 'object') {
    return { state: 'missing', source: null, item: null };
  }
  if (item.privateCopy) {
    return { state: 'private_copy', source: item.privateCopy, item };
  }
  if (item.payload) {
    return { state: 'legacy_inline_payload', source: item.a || '', item };
  }
  return { state: 'missing_private_copy', source: item.a || '', item };
}

export function claimStatus({ claimUntil, now, owned = false, selfAuthored = false, epochState = 'active' } = {}) {
  if (owned) return 'owned';
  if (selfAuthored) return 'self_authored';
  if (epochState === 'closed') return 'closed';
  const claimUntilNumber = Number(claimUntil || 0);
  const nowNumber = Number(now || Math.floor(Date.now() / 1000));
  if (claimUntilNumber > 0 && nowNumber > claimUntilNumber) {
    return 'expired';
  }
  return 'claimable';
}

export function normalizeReceiptEvidence({
  sourceAddress,
  eventId,
  buyerPubkey,
  policyEventId = '',
  claimEpoch = '',
  softgateEpoch = '',
  premiumMode = '',
  appVersion = '',
  receipts = [],
} = {}) {
  return {
    sourceAddress: sourceAddress || '',
    eventId: eventId || '',
    buyerPubkey: buyerPubkey || '',
    policyEventId,
    claimEpoch,
    softgateEpoch,
    premiumMode,
    appVersion,
    totalSats: receipts.reduce((sum, r) => sum + (Number(r.amountSats) || 0), 0),
    receipts: receipts.map((r) => ({
      role: r.role || '',
      recipientPubkey: r.recipientPubkey || '',
      amountSats: Number(r.amountSats) || 0,
      receiptId: r.receiptId || '',
      invoice: r.invoice || '',
      preimage: r.preimage || '',
    })),
  };
}

export function summarizePartialPayment(requiredPayments = []) {
  const payments = Array.isArray(requiredPayments) ? requiredPayments : [];
  const confirmed = payments.filter((p) => p.paid || p.receiptId);
  const missing = payments.filter((p) => !(p.paid || p.receiptId));
  return {
    status: missing.length === 0 ? 'complete' : confirmed.length > 0 ? 'partial' : 'unpaid',
    confirmedCount: confirmed.length,
    missingCount: missing.length,
    confirmedSats: confirmed.reduce((sum, p) => sum + (Number(p.amountSats) || 0), 0),
    missingSats: missing.reduce((sum, p) => sum + (Number(p.amountSats) || 0), 0),
    missing,
  };
}
