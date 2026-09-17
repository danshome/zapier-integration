'use strict';

const {CASE_GOODS_CODE_PATTERN} = require('./innovint');

/** Zapier stops an action after about 30 seconds, so keep each run small. */
const MAX_ORDERS_PER_RUN = 10;

/** Stop starting new work after this long, so a run always returns its results. */
const DEFAULT_TIME_BUDGET_MS = 20 * 1000;

/**
 * How long a run may keep starting new work.
 *
 * Zapier stops an action after about 30 seconds. The environment variable is
 * there so the tests can shorten it.
 *
 * @return {number} Milliseconds.
 */
const timeBudgetMs = () => {
  const configured = Number(process.env.REPLAY_TIME_BUDGET_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_TIME_BUDGET_MS;
};

/** Only orders the "New Paid Order" Zap would have recorded. */
const REPLAYABLE_FINANCIAL_STATUSES = ['PAID', 'PARTIALLY_REFUNDED'];

/** Line outcomes a person has to look at. */
const PROBLEM_LINE_RESULTS = ['error', 'invalid_sku', 'lot_not_found', 'not_processed', 'possible_duplicate'];

/** Order outcomes a person has to look at. */
const PROBLEM_ORDER_STATUSES = ['error', 'order_not_found', 'not_processed'];

/**
 * Turns "#3495, 3499\n3501" or ['3495', '#3499'] into ['3495', '3499', '3501'].
 *
 * @param {string|string[]} value - Order numbers as typed or mapped in Zapier.
 * @return {{numbers: string[], invalid: string[]}} Unique order numbers, and anything that is not one.
 */
const parseOrderNumbers = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  const items = raw
      .split(/[\s,;]+/)
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean);
  return {
    numbers: [...new Set(items.filter((item) => /^\d{1,12}$/.test(item)))],
    invalid: [...new Set(items.filter((item) => !/^\d{1,12}$/.test(item)))],
  };
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
 * Builds the bottle removals for an order: every line item whose SKU starts
 * with CG-, one adjustment per SKU.
 *
 * `bottles` counts what the customer kept, so refunded or removed line items
 * are not recorded as leaving the winery.
 *
 * @param {Object} order - Shopify order from lib/shopify.
 * @return {{sku: string, bottles: number, orderedBottles: number}[]} Adjustments to record.
 */
const buildAdjustments = (order) => {
  const bySku = new Map();
  for (const item of (order.lineItems && order.lineItems.nodes) || []) {
    const sku = String(item.sku || '').trim();
    if (!sku.startsWith('CG-')) {
      continue;
    }
    const ordered = Number(item.quantity || 0);
    const current = item.currentQuantity === undefined || item.currentQuantity === null ?
      ordered :
      Number(item.currentQuantity);
    const totals = bySku.get(sku) || {sku, bottles: 0, orderedBottles: 0};
    totals.bottles += Number.isFinite(current) ? current : 0;
    totals.orderedBottles += Number.isFinite(ordered) ? ordered : 0;
    bySku.set(sku, totals);
  }
  return [...bySku.values()].filter((entry) => entry.orderedBottles > 0);
};

/**
 * Says why an order must not be replayed, or null when it can be.
 *
 * @param {Object} order - Shopify order.
 * @return {string|null} A status such as skipped_refunded.
 */
const skipReason = (order) => {
  if (order.test) {
    return 'skipped_test_order';
  }
  if (order.cancelledAt) {
    return 'skipped_cancelled';
  }
  const status = order.displayFinancialStatus;
  if (status === 'VOIDED') {
    return 'skipped_voided';
  }
  if (status === 'REFUNDED') {
    return 'skipped_refunded';
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
  DEFAULT_TIME_BUDGET_MS,
  MAX_ORDERS_PER_RUN,
  PROBLEM_LINE_RESULTS,
  PROBLEM_ORDER_STATUSES,
  REPLAYABLE_FINANCIAL_STATUSES,
  buildAdjustments,
  isCaseGoodsSku,
  isSwitchedOn,
  parseOrderNumbers,
  skipReason,
  timeBudgetMs,
};
