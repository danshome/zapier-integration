# Changelog

## 1.2.0

- **Replay Shopify Order** no longer calls the Shopify Admin API. It takes one order's line items from a
  Shopify **Find Order** step, so it uses the Shopify connection you already have in Zapier.
- The Shopify store domain and access token fields are gone from the connection: no custom app, no second
  credential, and nothing for this integration to leak.
- The action now checks the order's financial status and cancelled date, and refuses SKU and quantity lists that
  do not line up rather than recording the wrong number of bottles.
- Everything else is unchanged: preview by default, exact lot codes, skip what InnoVint already has, flag
  near-duplicates, per-line results, and a failed step when a real run cannot finish.

## 1.1.0

- New action **Replay Shopify Orders**: records the bottled-wine removals for paid Shopify orders the Zap missed.
  It previews by default, records at the order's Shopify payment time, skips lines InnoVint already has, flags
  anything that looks like a near-duplicate, and fails the Zap step if a real run could not finish.
- The connection takes an optional Shopify store domain and Admin API access token, used only by that action. Only
  a `myshopify.com` domain is accepted and redirects are not followed, so the token can only reach Shopify.
- The InnoVint API key is only ever sent to innovint.us hosts, and page links that point elsewhere are refused.
- Case goods lots are now matched on an exact lot code. The old free-text match could record against a similar lot
  (for example `CG-B1401ESVMAD-CR` when the SKU was `CG-B1401ESVMAD`).
- Case Goods Adjustment now resolves every lot before recording anything, refuses name and quantity lists that do
  not line up, and skips a line InnoVint already has at the same effective time, so re-running the same Zap step
  cannot record it twice. A sale of the same wine at a nearby but different time is still recorded, and noted in
  the log.
- Rate limiting (HTTP 429) from InnoVint and Shopify is waited out instead of failing the run.
- Winery ids, lot codes, bottle counts and compliance types are validated before they go into a request.
- Redirects are never followed, for either API.
- Runs on Node.js 22 at Zapier (platform 19); the tests and tooling run on Node 22 and Node 26.
