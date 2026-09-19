'use strict';

const {listAllPages, validateWineryId, wineryUrl} = require('../lib/innovint');

const GALLONS_PER_LITER = 0.264172052;
const GALLONS_PER_HECTOLITER = 26.4172052;
const LITERS_PER_GALLON = 3.785411784;

/** Bottles per case InnoVint might be using, most common first. */
const CASE_SIZES = [12, 6, 24, 3, 4];
/** Standard wine bottle sizes in litres. */
const BOTTLE_SIZES_L = [0.1875, 0.375, 0.5, 0.75, 1, 1.5, 3, 5];
const DEFAULT_CASE_SIZE = 12;
/** A volume this far from every standard bottle size says nothing about the case size. */
const MAX_INFERENCE_ERROR = 0.05;

/**
 * Bottle sizes a lot's code or name can announce, checked in order. When the
 * volume fits more than one case size (ten cases of six magnums hold exactly
 * what ten cases of twelve 750s do), the announced size settles it.
 */
const SIZE_HINTS = [
  {pattern: /MAGNUM|1[.,]5\s*L\b|1500\s*ML/i, liters: 1.5},
  {pattern: /DOUBLE\s*MAGNUM|3\s*L\b|3000\s*ML/i, liters: 3},
  {pattern: /\bHALF\b|375\s*ML|\b375\b/i, liters: 0.375},
  {pattern: /500\s*ML|\b500\b/i, liters: 0.5},
];

/**
 * Reads a bottle size out of a lot's code or name, if it announces one.
 *
 * @param {string} code - Lot code.
 * @param {string} name - Lot name.
 * @return {number|null} Litres, or null when nothing is announced.
 */
const hintedBottleSize = (code, name) => {
  const text = `${code || ''} ${name || ''}`;
  // Longest names first so DOUBLE MAGNUM is not read as MAGNUM.
  const hit = [SIZE_HINTS[1], SIZE_HINTS[0], SIZE_HINTS[2], SIZE_HINTS[3]].find((h) => h.pattern.test(text));
  return hit ? hit.liters : null;
};

/**
 * Converts an InnoVint volume to US gallons.
 *
 * @param {{value: number, unit: string}|undefined} volume - Lot volume.
 * @return {number|null} Gallons, or null when the lot has no volume.
 */
const toGallons = (volume) => {
  if (!volume || typeof volume.value !== 'number') {
    return null;
  }
  const unit = String(volume.unit || '').toLowerCase();
  if (unit.startsWith('gal')) {
    return volume.value;
  }
  if (unit === 'l' || unit.startsWith('lit')) {
    return volume.value * GALLONS_PER_LITER;
  }
  if (unit === 'hl') {
    return volume.value * GALLONS_PER_HECTOLITER;
  }
  if (unit === 'ml' || unit.startsWith('milli')) {
    return volume.value * GALLONS_PER_LITER / 1000;
  }
  return null; // An unknown unit is no volume at all, never a guess.
};

/**
 * Works out how many bottles a lot holds.
 *
 * InnoVint reports bottles on hand as full cases plus loose bottles, and does
 * not say how many bottles make a case. The case size is inferred from the
 * lot's volume: the size that makes volume ÷ bottles land nearest a standard
 * bottle size wins, with 12 as the tie-break and the fallback when there is
 * no volume to check against. A lot of nothing but full cases can be
 * ambiguous (ten cases of six magnums hold exactly what ten cases of twelve
 * 750s do); a size announced in the lot code or name ("MAGNUM", "1.5L",
 * "375") settles that, and failing that a single loose bottle does.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} code - Lot code, for error messages and size hints.
 * @param {string} name - Lot name, for size hints.
 * @param {Object|undefined} onHand - InnoVint bottlesOnHand ({cases, bottles}).
 * @param {number|null} gallons - Lot volume in gallons.
 * @return {Object} bottles (total), cases, loose, bottlesPerCase, bottleSizeMl.
 */
const countBottles = (z, code, name, onHand, gallons) => {
  const cases = Number((onHand && onHand.cases) || 0);
  const loose = Number((onHand && onHand.bottles) || 0);
  if (!Number.isFinite(cases) || !Number.isFinite(loose) || cases < 0 || loose < 0) {
    throw new z.errors.Error(
        `InnoVint returned an unreadable bottle count for ${code}: ${JSON.stringify(onHand).slice(0, 80)}`,
        'InvalidResponse', 502);
  }
  const liters = typeof gallons === 'number' && gallons > 0 ? gallons * LITERS_PER_GALLON : null;

  let bottlesPerCase = DEFAULT_CASE_SIZE;
  let bottleSizeMl = null;
  if (liters !== null && (cases > 0 || loose > 0)) {
    const hinted = hintedBottleSize(code, name);
    const candidates = CASE_SIZES
        .map((size) => {
          const total = cases * size + loose;
          if (total <= 0) {
            return null;
          }
          const perBottle = liters / total;
          const nearest = BOTTLE_SIZES_L.reduce((a, b) => (Math.abs(b - perBottle) < Math.abs(a - perBottle) ? b : a));
          return {size, nearest, error: Math.abs(perBottle - nearest) / nearest};
        })
        .filter((c) => c && c.error <= MAX_INFERENCE_ERROR);
    // Prefer the case size that agrees with what the lot calls itself; otherwise the
    // closest fit, and CASE_SIZES order (12 first) breaks exact ties.
    const best = candidates.find((c) => hinted !== null && Math.abs(c.nearest - hinted) < 1e-9) ||
        candidates.reduce((a, c) => (a === null || c.error < a.error - 1e-9 ? c : a), null);
    if (best) {
      bottlesPerCase = best.size;
      bottleSizeMl = Math.round(best.nearest * 1000);
    }
    // No candidate: the volume fits no standard bottle; keep 12 and say nothing.
  }

  return {bottles: cases * bottlesPerCase + loose, cases, loose, bottlesPerCase, bottleSizeMl};
};

const MAX_PATTERN_LENGTH = 100;

/**
 * Matches a lot code against a wildcard pattern without a regular expression.
 *
 * `*` matches any run of characters and `?` matches one; everything else is
 * literal and case does not matter. This is the classic two-pointer glob
 * match, linear in the code length however many wildcards the pattern has,
 * so a pattern such as `**********a` cannot stall the search.
 *
 * @param {string} pattern - Upper-cased pattern.
 * @param {string} text - Upper-cased lot code.
 * @return {boolean} Whether the code matches.
 */
const globMatch = (pattern, text) => {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = -1;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === '?' || pattern[p] === text[t])) {
      p++;
      t++;
    } else if (p < pattern.length && pattern[p] === '*') {
      starP = p++;
      starT = t;
    } else if (starP >= 0) {
      p = starP + 1;
      t = ++starT;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') {
    p++;
  }
  return p === pattern.length;
};

/**
 * Builds the code filter for a wildcard pattern.
 *
 * @param {Object} z - The Zapier z object.
 * @param {string} pattern - For example CG-*, CG-B17*, *ROSE*.
 * @return {function(string): boolean} Filter, matching everything when the pattern is empty.
 */
const codeFilter = (z, pattern) => {
  const text = String(pattern || '').trim().toUpperCase();
  if (!text) {
    return () => true;
  }
  if (text.length > MAX_PATTERN_LENGTH) {
    throw new z.errors.Error(
        `The lot code pattern is longer than ${MAX_PATTERN_LENGTH} characters.`, 'InvalidInput', 400);
  }
  return (code) => globMatch(text, String(code).toUpperCase());
};

/**
 * Lists every unarchived case goods lot with its bottles on hand.
 *
 * Zapier hands only the first search result to later steps, so everything is
 * returned in one object: line items for mapping, plus JSON strings that a
 * Code step can parse in one go.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} bundle - The Zapier bundle object.
 * @return {Promise<Object[]>} One result holding all case goods lots.
 */
const getCaseGoodsInventory = async (z, bundle) => {
  const wineryId = validateWineryId(z, bundle.inputData.wineryId);
  const matches = codeFilter(z, bundle.inputData.codePattern);

  const lots = (await listAllPages(z, `${wineryUrl(wineryId)}/lots`, {archived: false}))
      .filter((lot) => lot.lotType === 'CASE_GOODS' && lot.code)
      .filter((lot) => matches(lot.code))
      .map((lot) => {
        const gallons = toGallons(lot.volume);
        const count = countBottles(z, lot.code, lot.name, lot.bottlesOnHand, gallons);
        return {
          code: lot.code,
          name: lot.name || '',
          stage: lot.stage || '',
          bottles: count.bottles,
          cases: count.cases,
          looseBottles: count.loose,
          bottlesPerCase: count.bottlesPerCase,
          bottleSizeMl: count.bottleSizeMl,
          gallons,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

  // Two unarchived lots with one code are added together, so a code never
  // under-reports; Object.create(null) keeps a code like __proto__ honest.
  const bottlesByCode = Object.create(null);
  const gallonsByCode = Object.create(null);
  lots.forEach((lot) => {
    bottlesByCode[lot.code] = (bottlesByCode[lot.code] || 0) + lot.bottles;
    gallonsByCode[lot.code] = lot.gallons === null && gallonsByCode[lot.code] === undefined ?
        null : (gallonsByCode[lot.code] || 0) + (lot.gallons || 0);
  });

  return [{
    id: `${wineryId}:${new Date().toISOString()}`,
    wineryId,
    lotCount: lots.length,
    bottlesJson: JSON.stringify(Object.fromEntries(Object.entries(bottlesByCode))),
    gallonsJson: JSON.stringify(Object.fromEntries(Object.entries(gallonsByCode))),
    lots,
  }];
};

module.exports = {
  key: 'getCaseGoodsInventory',
  noun: 'Case Goods Inventory',
  display: {
    label: 'Get Case Goods Inventory',
    description: 'Lists case goods lots matching a wildcard pattern, with bottles on hand, in one result.',
  },
  operation: {
    perform: getCaseGoodsInventory,
    inputFields: [
      {
        key: 'wineryId',
        required: true,
        type: 'string',
        dynamic: 'listWineriesDropdown.id.name',
      },
      {
        key: 'codePattern',
        label: 'Lot Code Pattern',
        required: false,
        type: 'string',
        default: 'CG-*',
        helpText: 'Wildcard match on the lot code (the SKU): * is any run of characters, ? is one. ' +
            'CG-* for every case goods lot, CG-B17* for the 2017 barrel lots, *ROSE* for every rosé. ' +
            'Leave empty for all lots.',
      },
    ],
    outputFields: [
      {key: 'id', label: 'Run ID', type: 'string'},
      {key: 'wineryId', label: 'Winery ID', type: 'string'},
      {key: 'lotCount', label: 'Lot Count', type: 'integer'},
      {key: 'bottlesJson', label: 'Bottles By Lot Code (JSON, code = SKU)', type: 'string'},
      {key: 'gallonsJson', label: 'Gallons By Lot Code (JSON)', type: 'string'},
      {key: 'lots[]code', label: 'Lot Code', type: 'string'},
      {key: 'lots[]name', label: 'Lot Name', type: 'string'},
      {key: 'lots[]stage', label: 'Stage', type: 'string'},
      {key: 'lots[]bottles', label: 'Bottles On Hand (total)', type: 'integer'},
      {key: 'lots[]cases', label: 'Full Cases', type: 'integer'},
      {key: 'lots[]looseBottles', label: 'Loose Bottles', type: 'integer'},
      {key: 'lots[]bottlesPerCase', label: 'Bottles Per Case (inferred)', type: 'integer'},
      {key: 'lots[]bottleSizeMl', label: 'Bottle Size ml (inferred)', type: 'integer'},
      {key: 'lots[]gallons', label: 'Gallons', type: 'number'},
    ],
    sample: {
      id: 'wnry_TESTWINERY000000000000000:2026-09-18T00:00:00.000Z',
      wineryId: 'wnry_TESTWINERY000000000000000',
      lotCount: 2,
      bottlesJson: '{"CG-B1700RCVMER":899,"CG-B2400RCVCHA":819}',
      gallonsJson: '{"CG-B1700RCVMER":178.116,"CG-B2400RCVCHA":162.266}',
      lots: [
        {
          code: 'CG-B1700RCVMER', name: 'B 17 00 RCV MER', stage: 'PRE_RELEASE',
          bottles: 899, cases: 74, looseBottles: 11, bottlesPerCase: 12, bottleSizeMl: 750, gallons: 178.116,
        },
        {
          code: 'CG-B2400RCVCHA', name: 'B 24 00 RCV CHA', stage: 'UNFINISHED',
          bottles: 819, cases: 68, looseBottles: 3, bottlesPerCase: 12, bottleSizeMl: 750, gallons: 162.266,
        },
      ],
    },
  },
};
