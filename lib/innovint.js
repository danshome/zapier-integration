'use strict';

const BASE_URL = 'https://sutter.innovint.us/api/v1';
const API_HOST = 'sutter.innovint.us';

/** Two adjustments this close together are the same recording. */
const EXACT_MATCH_MS = 1000;

/** Anything this close on the same lot is worth a person looking at. */
const POSSIBLE_DUPLICATE_MS = 2 * 60 * 1000;

/** Guard rails so a paging loop can never run away. */
const MAX_PAGES = 100;
const PAGE_SIZE = 100;

/** InnoVint allows 120 requests a minute and answers 429 with Retry-After. */
const MAX_THROTTLE_RETRIES = 2;
const MAX_RETRY_DELAY_SECONDS = 5;

/** How many actions one line may inspect before giving up rather than grinding. */
const MAX_DETAIL_LOOKUPS = 40;

const WINERY_ID_PATTERN = /^wnry_[A-Za-z0-9]{1,64}$/;
const ACTION_ID_PATTERN = /^act_[A-Za-z0-9]{1,64}$/;
const LOT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const CASE_GOODS_CODE_PATTERN = /^CG-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

const COMPLIANCE_CHOICES = {
  ONBOARDING: 'ONBOARDING',
  TAX_PAID_WINE_RETURNED_TO_BOND: 'TAX_PAID_WINE_RETURNED_TO_BOND',
  INVENTORY_GAINS: 'INVENTORY_GAINS',
  INVENTORY_SHORTAGE: 'INVENTORY_SHORTAGE',
  REMOVED_FOR_EXPORT: 'REMOVED_FOR_EXPORT',
  REMOVED_FOR_FAMILY_USE: 'REMOVED_FOR_FAMILY_USE',
  USED_FOR_TESTING: 'USED_FOR_TESTING',
  USED_FOR_TASTING: 'USED_FOR_TASTING',
  BREAKAGE: 'BREAKAGE',
  BOND_TO_BOND_TRANSFER_IN: 'BOND_TO_BOND_TRANSFER_IN',
  BOND_TO_BOND_TRANSFER_OUT: 'BOND_TO_BOND_TRANSFER_OUT',
  REMOVED_TAXPAID: 'REMOVED_TAXPAID',
  CG_BOTTLED_WINE_DUMPED_TO_BULK: 'CG_BOTTLED_WINE_DUMPED_TO_BULK',
};

const JSON_HEADERS = {'Content-Type': 'application/json', 'Accept': 'application/json'};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when a URL belongs to InnoVint over HTTPS.
 *
 * @param {string} url - Absolute URL.
 * @return {boolean} Whether the host is innovint.us or a subdomain of it.
 */
const isInnoVintUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname === 'innovint.us' || parsed.hostname.endsWith('.innovint.us'));
  } catch (error) {
    return false;
  }
};

/**
 * Refuses any URL that is not the InnoVint API, so a page link in a response
 * can never send the API key somewhere else.
 *
 * @param {string} url - URL about to be requested.
 * @return {string} The same URL.
 */
const assertApiUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`Refusing to request "${String(url).slice(0, 80)}": not a URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== API_HOST ||
      parsed.username || parsed.password || !parsed.pathname.startsWith('/api/v1/')) {
    throw new Error(`Refusing to send the InnoVint API key to ${parsed.origin}${parsed.pathname}.`);
  }
  return url;
};

/**
 * Checks a winery id before it goes into a URL.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} wineryId - Value from the Winery field.
 * @return {string} The winery id.
 */
const validateWineryId = (z, wineryId) => {
  const value = String(wineryId || '').trim();
  if (!WINERY_ID_PATTERN.test(value)) {
    throw new z.errors.Error(
        `"${value.slice(0, 40)}" is not an InnoVint winery ID. Choose the winery from the dropdown.`,
        'InvalidInput',
        400,
    );
  }
  return value;
};

/**
 * Builds the base URL for one winery.
 *
 * @param {string} wineryId - Validated winery id.
 * @return {string} URL prefix.
 */
const wineryUrl = (wineryId) => `${BASE_URL}/wineries/${encodeURIComponent(wineryId)}`;

const retryAfterSeconds = (response) => {
  const header = response.headers && response.headers.get && response.headers.get('retry-after');
  const seconds = parseInt(header, 10);
  return Number.isNaN(seconds) || seconds < 0 ? null : seconds;
};

/**
 * Makes an InnoVint request, waiting and retrying when InnoVint throttles.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} options - z.request options plus allowStatuses.
 * @param {number[]} [options.allowStatuses] - Statuses to return instead of throwing.
 * @return {Promise<Object>} The response.
 */
const innovintRequest = async (z, options) => {
  const {allowStatuses = [], ...request} = options;
  assertApiUrl(request.url);

  for (let attempt = 0; ; attempt++) {
    const response = await z.request({
      ...request,
      headers: {...JSON_HEADERS, ...(request.headers || {})},
      skipThrowForStatus: true,
      throwForThrottlingEarly: false,
      // A redirect could hand the next response to another host; never follow one.
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error(
          `InnoVint answered with a redirect (HTTP ${response.status}) for ${new URL(request.url).pathname}; ` +
          'refusing to follow it.');
    }

    if (response.status !== 429) {
      if (!allowStatuses.includes(response.status)) {
        response.throwForStatus();
      }
      return response;
    }

    const delay = retryAfterSeconds(response);
    if (attempt >= MAX_THROTTLE_RETRIES) {
      throw new z.errors.ThrottledError(
          'InnoVint is rate limiting this connection (HTTP 429). Wait a minute and run it again.',
          delay || 60,
      );
    }
    await sleep(Math.min(delay || attempt + 1, MAX_RETRY_DELAY_SECONDS) * 1000);
  }
};

/**
 * Reads every page of a list endpoint.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} url - First page URL (must be the InnoVint API).
 * @param {Object} [params] - Query parameters for the first page.
 * @return {Promise<Object[]>} The `data` object of every result.
 */
const listAllPages = async (z, url, params) => {
  const items = [];
  let nextUrl = url;
  let nextParams = {limit: PAGE_SIZE, ...(params || {})};

  for (let page = 0; nextUrl; page++) {
    if (page >= MAX_PAGES) {
      throw new Error(`InnoVint returned more than ${MAX_PAGES} pages for ${new URL(url).pathname}; stopping.`);
    }
    const response = await innovintRequest(z, {url: nextUrl, params: nextParams});
    const body = response.data || {};
    items.push(...(body.results || []).map((result) => result.data).filter(Boolean));
    nextUrl = (body.pagination && body.pagination.next) || null;
    nextParams = undefined; // The next-page URL already carries the query string.
  }

  return items;
};

/**
 * Finds the lot whose code is exactly the given case goods name.
 *
 * A free-text search also matches CG-B1600RCVMER-CR when CG-B1600RCVMER was
 * asked for, so only an exact code counts.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} wineryId - Validated winery id.
 * @param {string} code - Lot code, e.g. CG-B1700RCVMER.
 * @return {Promise<string|null>} The lot id, or null when no lot has that code.
 */
const findLotIdByCode = async (z, wineryId, code) => {
  if (!LOT_CODE_PATTERN.test(String(code || ''))) {
    throw new Error(`"${String(code).slice(0, 40)}" is not a lot code.`);
  }

  const url = `${wineryUrl(wineryId)}/lots`;
  const exactMatch = (response) =>
    ((response.data && response.data.results) || [])
        .map((result) => result.data)
        .find((lot) => lot && lot.code === code);

  let lot = exactMatch(await innovintRequest(z, {
    url,
    params: {codeIn: code, archived: false, limit: 10},
  }));

  if (!lot) {
    lot = exactMatch(await innovintRequest(z, {
      url,
      params: {q: code, archived: false, limit: 50},
    }));
  }

  return lot ? lot.id : null;
};

/**
 * Retrieves an action as a case goods adjustment.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} wineryId - Validated winery id.
 * @param {string} actionId - Action id.
 * @return {Promise<Object|null>} Adjustment data, or null if the action is something else.
 */
const getCaseGoodsAdjustment = async (z, wineryId, actionId) => {
  if (!ACTION_ID_PATTERN.test(String(actionId || ''))) {
    throw new Error(`"${String(actionId).slice(0, 40)}" is not an InnoVint action id.`);
  }
  const response = await innovintRequest(z, {
    url: `${wineryUrl(wineryId)}/actions/caseGoodsAdjustmentActions/${encodeURIComponent(actionId)}`,
    allowStatuses: [404],
  });
  if (response.status === 404) {
    return null;
  }
  return (response.data && response.data.data) || null;
};

const toDateOnly = (date) => date.toISOString().slice(0, 10);

/**
 * Looks up adjustments already recorded, so nothing is recorded twice.
 *
 * Each existing adjustment can only satisfy one line in a run: two orders for
 * the same wine a minute apart must not both match the one adjustment the Zap
 * recorded for the first of them.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} wineryId - Validated winery id.
 * @return {{find: Function}} A matcher for this run.
 */
const createAdjustmentMatcher = (z, wineryId) => {
  const windows = new Map();
  const details = new Map();
  const claimed = new Set();

  const actionsAround = (target) => {
    const day = 24 * 60 * 60 * 1000;
    const fromDate = toDateOnly(new Date(target - day));
    const toDate = toDateOnly(new Date(target + day));
    const key = `${fromDate}|${toDate}`;
    if (!windows.has(key)) {
      const pending = listAllPages(z, `${wineryUrl(wineryId)}/actions`, {
        effectiveAtAfter: fromDate,
        effectiveAtBefore: toDate,
      });
      // A failed lookup must not be cached, or every later line fails with it.
      pending.catch(() => windows.delete(key));
      windows.set(key, pending);
    }
    return windows.get(key);
  };

  const adjustmentFor = (actionId) => {
    if (!details.has(actionId)) {
      const pending = getCaseGoodsAdjustment(z, wineryId, actionId);
      pending.catch(() => details.delete(actionId));
      details.set(actionId, pending);
    }
    return details.get(actionId);
  };

  /**
   * @param {Object} args - What is about to be recorded.
   * @param {string} args.lotId - Lot id.
   * @param {string} args.compliance - Compliance type.
   * @param {string} args.effectiveAt - ISO date-time of the order.
   * @return {Promise<Object|null>} {match: 'exact'|'possible', adjustment} or null.
   */
  const find = async ({lotId, compliance, effectiveAt}) => {
    const target = Date.parse(effectiveAt);
    const actions = await actionsAround(target);
    const nearby = actions
        .filter((action) => action && action.id && !action.deleted && !claimed.has(action.id))
        .map((action) => ({action, delta: Math.abs(Date.parse(action.effectiveAt) - target)}))
        .filter((row) => row.delta <= POSSIBLE_DUPLICATE_MS)
        .sort((left, right) => left.delta - right.delta);

    const toLookUp = nearby.filter(({action}) => !details.has(action.id)).length;
    if (toLookUp > MAX_DETAIL_LOOKUPS) {
      throw new Error(
          `InnoVint has ${nearby.length} actions within two minutes of ${effectiveAt}, too many to check one by ` +
          'one. Record this line by hand, or check InnoVint and replay with the skip switch off.');
    }

    let possible = null;
    for (const {action} of nearby) {
      const adjustment = await adjustmentFor(action.id);
      if (!adjustment || adjustment.deleted || adjustment.lotId !== lotId) {
        continue;
      }
      const delta = Math.abs(Date.parse(adjustment.effectiveAt) - target);
      if (adjustment.compliance === compliance && delta <= EXACT_MATCH_MS) {
        claimed.add(action.id);
        return {match: 'exact', adjustment};
      }
      if (!possible) {
        possible = adjustment;
      }
    }

    return possible ? {match: 'possible', adjustment: possible} : null;
  };

  return {find};
};

/**
 * Records a case goods adjustment of whole bottles.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} args - Adjustment arguments.
 * @param {string} args.wineryId - Validated winery id.
 * @param {string} args.lotId - Lot id.
 * @param {number} args.bottles - Number of bottles, a positive whole number.
 * @param {string} args.compliance - Compliance type.
 * @param {string} args.effectiveAt - ISO date-time.
 * @return {Promise<string>} The InnoVint reference number.
 */
const createCaseGoodsAdjustment = async (z, {wineryId, lotId, bottles, compliance, effectiveAt}) => {
  if (!Number.isInteger(bottles) || bottles <= 0) {
    throw new Error(`Bottles must be a whole number above zero, got "${bottles}".`);
  }
  if (!COMPLIANCE_CHOICES[compliance]) {
    throw new Error(`"${String(compliance).slice(0, 40)}" is not an InnoVint compliance type.`);
  }
  if (Number.isNaN(Date.parse(effectiveAt))) {
    throw new Error(`"${String(effectiveAt).slice(0, 40)}" is not a date and time.`);
  }

  const response = await innovintRequest(z, {
    url: `${wineryUrl(wineryId)}/actions/caseGoodsAdjustmentActions`,
    method: 'POST',
    body: {
      data: {
        bottleChanges: {bottles, cases: 0, pallets: 0},
        compliance,
        lotId,
        effectiveAt,
      },
    },
  });

  const data = response.data && response.data.data;
  if (!data || !data.referenceNumber) {
    throw new Error('InnoVint accepted the adjustment but did not return a reference number.');
  }
  return data.referenceNumber;
};

module.exports = {
  BASE_URL,
  MAX_DETAIL_LOOKUPS,
  CASE_GOODS_CODE_PATTERN,
  COMPLIANCE_CHOICES,
  EXACT_MATCH_MS,
  MAX_PAGES,
  POSSIBLE_DUPLICATE_MS,
  assertApiUrl,
  createAdjustmentMatcher,
  createCaseGoodsAdjustment,
  findLotIdByCode,
  getCaseGoodsAdjustment,
  innovintRequest,
  isInnoVintUrl,
  listAllPages,
  validateWineryId,
  wineryUrl,
};
