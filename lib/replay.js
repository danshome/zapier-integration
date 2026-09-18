'use strict';

const {CASE_GOODS_CODE_PATTERN} = require('./innovint');

/** Only orders the "New Paid Order" Zap would have recorded. */
const REPLAYABLE_FINANCIAL_STATUSES = ['PAID', 'PARTIALLY_REFUNDED'];

/** Line outcomes a person has to look at. */
const PROBLEM_LINE_RESULTS = ['error', 'invalid_sku', 'invalid_quantity', 'lot_not_found', 'possible_duplicate'];

/**
 * Splits a Zapier list field into its items.
 *
 * A mapped line-item field arrives either as an array or as one comma
 * separated string, and empty positions matter: they keep SKUs and quantities
 * lined up when a line item has no SKU.
 *
 * @param {*} value - Raw input value.
 * @return {string[]} One trimmed item per line item.
 */
const splitList = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((item) => String(item === undefined || item === null ? '' : item).trim());
};

/**
 * Reads a safety switch (Dry Run, Skip Lines Already in InnoVint).
 *
 * These stay on unless the value clearly says otherwise, so a mistyped or
 * unmapped value can never turn a preview into a recording.
 *
 * @param {*} value - Raw input value.
 * @return {boolean} Whether the switch is on.
 */
const isSwitchedOn = (value) => {
  if (value === false) {
    return false;
  }
  if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
    // An array or object is not a "no", and must not read as one.
    return true;
  }
  return !/^(false|no|n|off|0)$/i.test(String(value === undefined || value === null ? '' : value).trim());
};

/**
 * Pairs the SKU list with the quantity list and adds up the bottles per lot
 * code, the same way the live Zap does: only SKUs that start with CG- count.
 *
 * @param {string[]} skus - Line item SKUs, in order.
 * @param {string[]} quantities - Line item quantities, in the same order.
 * @return {{sku: string, bottles: number, valid: boolean}[]} One entry per case goods SKU.
 */
const buildAdjustments = (skus, quantities) => {
  const bySku = new Map();
  skus.forEach((rawSku, index) => {
    const sku = String(rawSku || '').trim();
    if (!sku.startsWith('CG-')) {
      return;
    }
    const raw = String(quantities[index] === undefined ? '' : quantities[index]).trim();
    const bottles = Number(raw);
    const valid = /^\d+$/.test(raw) && bottles > 0;
    const entry = bySku.get(sku) || {sku, bottles: 0, valid: true};
    entry.bottles += valid ? bottles : 0;
    entry.valid = entry.valid && valid;
    bySku.set(sku, entry);
  });
  return [...bySku.values()];
};

/**
 * Says why an order must not be replayed, or null when it can be.
 *
 * @param {Object} order - What the Shopify step reported about the order.
 * @param {string} [order.financialStatus] - Shopify's Display Financial Status.
 * @param {string} [order.cancelledAt] - Shopify's Cancelled At, empty when the order stands.
 * @return {string|null} A status such as skipped_refunded.
 */
const skipReason = ({financialStatus, cancelledAt}) => {
  if (String(cancelledAt || '').trim()) {
    return 'skipped_cancelled';
  }
  const status = String(financialStatus || '').trim().toUpperCase();
  if (status === 'VOIDED') {
    return 'skipped_voided';
  }
  if (status === 'REFUNDED') {
    return 'skipped_refunded';
  }
  if (!status) {
    return 'skipped_status_unknown';
  }
  if (!REPLAYABLE_FINANCIAL_STATUSES.includes(status)) {
    return 'skipped_not_paid';
  }
  return null;
};

/**
 * True when a SKU is a case goods code this integration can look up.
 *
 * @param {string} sku - Shopify SKU.
 * @return {boolean} Whether it is a usable lot code.
 */
const isCaseGoodsSku = (sku) => CASE_GOODS_CODE_PATTERN.test(String(sku || ''));

module.exports = {
  PROBLEM_LINE_RESULTS,
  REPLAYABLE_FINANCIAL_STATUSES,
  buildAdjustments,
  isCaseGoodsSku,
  isSwitchedOn,
  skipReason,
  splitList,
};
