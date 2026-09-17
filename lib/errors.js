'use strict';

const MAX_MESSAGE_LENGTH = 300;

/**
 * Turns an error into one readable sentence.
 *
 * Zapier wraps HTTP failures in errors whose message is a JSON blob, which is
 * unreadable in a Zap history or in this action's output. This pulls out the
 * part a person needs.
 *
 * @param {*} error - Anything thrown by a request or by this integration.
 * @return {string} A readable message.
 */
const describeError = (error) => {
  const raw = (error && error.message) || String(error || 'Unknown error');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    return raw.slice(0, MAX_MESSAGE_LENGTH);
  }

  if (!parsed || typeof parsed !== 'object') {
    return raw.slice(0, MAX_MESSAGE_LENGTH);
  }

  if (parsed.status && parsed.content !== undefined) {
    let host = 'The server';
    try {
      host = new URL(parsed.request.url).hostname;
    } catch (urlError) {
      // Keep the generic host name.
    }
    return `${host} returned HTTP ${parsed.status}${detailsOf(parsed.content)}`.slice(0, MAX_MESSAGE_LENGTH);
  }

  return String(parsed.message || raw).slice(0, MAX_MESSAGE_LENGTH);
};

/**
 * Reads the human-readable part of an API error body.
 *
 * @param {string} content - Response body.
 * @return {string} Either ": <details>" or an empty string.
 */
const detailsOf = (content) => {
  try {
    const body = JSON.parse(content);
    const details = (body.errors || [])
        .map((error) => error.details || error.message || error.code)
        .filter(Boolean)
        .join('; ');
    if (details) {
      return `: ${details}`;
    }
  } catch (parseError) {
    // Fall through to the raw body.
  }
  const text = String(content || '').trim();
  return text ? `: ${text.slice(0, 120)}` : '';
};

module.exports = {describeError};
