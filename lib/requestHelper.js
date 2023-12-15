/**
 * Delays the execution of the script for the specified number of milliseconds.
 *
 * @param {number} ms - The number of milliseconds to delay the execution.
 * @return {Promise} - A promise that resolves after the specified number of milliseconds.
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a request to the specified URL with optional parameters and headers, and handles retries in
 * case of rate limiting errors.
 *
 * @param {object} z - The instance of the `Zapier` module.
 * @param {string} url - The URL to send the request to.
 * @param {string} method - The HTTP method to use for the request (e.g., "GET", "POST", "PUT").
 * @param {object} params - The parameters to include in the request (if applicable).
 * @param {object} headers - The headers to include in the request (if applicable).
 * @param {number} [retry=0] - The number of retries attempted so far (defaults to 0).
 * @return {Promise<object>} - A promise that resolves with the JSON response of the request.
 *
 * @throws {object} - The error object returned by the request in case of failure.
 */
async function requestWithRetry(z, url, method, params, headers, retry = 0) {
  try {
    const response = await z.request(url, {method, params, headers});
    response.throwForStatus();
    return response.json();
  } catch (error) {
    if (error.status === 429 && retry < 10) {
      const delayMs = (parseInt(error.headers['Retry-After'], 10) || 1) * 1000 +
          500;
      await delay(delayMs);
      return await requestWithRetry(z, url, method, params, headers, retry + 1);
    } else {
      throw error;
    }
  }
}

module.exports = {
  requestWithRetry,
  delay, // you can expose delay function too if would need this elsewhere
};
