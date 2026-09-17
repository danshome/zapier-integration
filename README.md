<p style="text-align: center;">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://www.innovint.us/wp-content/uploads/2021/02/cropped-innovint-icon-150x150.png">
    <source media="(prefers-color-scheme: light)" srcset="https://www.innovint.us/wp-content/uploads/2021/02/cropped-innovint-icon-150x150.png">
    <img width="150" height="150" alt="" src="[https://www.innovint.us/wp-content/uploads/2021/02/cropped-innovint-icon-150x150.png](https://innovint.us)">
  </picture>
</p>

# Innovint Zapier Integration

Connect Innovint to hundreds of other apps with Zapier

Zapier lets you connect Innovint to 4,000+ other web services. Automated connections called Zaps,
set up in minutes with no coding, can automate your day-to-day tasks and build workflows between
apps that otherwise wouldn't be possible.
Each Zap has one app as the Trigger, where your information comes from and which causes one or more
Actions in other apps, where your data gets sent automatically.

<div style="text-align: center;">

[**`Home`**](https://zapier.com/apps/Innovint/integrations) &nbsp;|&nbsp;
[**`Innovint API Docs`**](https://sutter.innovint.us/api/v1/docs/) &nbsp;|&nbsp;
[**`Innovint API Schema`**](https://sutter.innovint.us/api/v1/schema/) &nbsp;|&nbsp;
[**`Innovint Support`**](https://support.innovint.us/) &nbsp;|&nbsp;

</div>

<div style="text-align: center;">

<a href="https://zapier.com/apps/Innovint/integrations"><img src="https://img.shields.io/badge/dynamic/json?label=Zapier&amp;query=%24.version&amp;url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanshome%2Fzapier-integration%2Fmain%2Fpackage.json&amp;logo=zapier" alt="Zapier"></a>
[![Tests](https://github.com/danshome/zapier-integration/actions/workflows/test.yml/badge.svg)](https://github.com/danshome/zapier-integration/actions/workflows/test.yml)
[![CodeQL](https://github.com/danshome/zapier-integration/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/danshome/zapier-integration/actions/workflows/github-code-scanning/codeql)
<a href="https://github.com/danshome/zapier-integration/graphs/contributors"><img src="https://img.shields.io/github/contributors/danshome/zapier-integration?cacheSeconds=10001" alt="GitHub contributors"></a>
<a href="https://github.com/danshome/zapier-integration/blob/master/LICENSE"><img src="https://img.shields.io/github/license/danshome/zapier-integration?cacheSeconds=3600" alt="License"></a>

</div>

## Getting started

### Integration

This integration contains the following triggers, actions, and searches:

- **Triggers for Dropdown Fields**

  - [x] List Analysis Types
  - [x] List Appellations
  - [x] List Dry Good Types
  - [x] List Varietals
  - [x] List Wineries
  - [ ] List Winery Actions
  - [ ] List Blocks (Wineries)
  - [ ] List Blocks (Wineries)
  - [ ] List Bonds (Wineries)
  - [ ] List Vendors (Wineries)
  - [ ] List Vessels (Wineries)
  - [ ] List Vineyards (Wineries)

- **Other Triggers**

  - [ ] List Personal Access Tokens
  - [ ] List Analysis Actions (Wineries)
  - [ ] List Process Fruit To Volume Actions (Wineries)
  - [ ] List Receive Fruit Actions (Wineries)
  - [ ] List Addition Actions (Wineries)
  - [ ] List Additive Snapshots (Wineries)
  - [ ] List Additive Indicators (Wineries)
  - [ ] List Lots (Wineries)
  - [ ] List Lot Additive Snapshot (Wineries)
  - [ ] List Lot Block Components (Wineries)
  - [ ] List Transfer Actions (Wineries)

- **Actions**

  - [ ] Create Personal Access Token
  - [ ] Create Analysis Action (Wineries)
  - [ ] Create Process Fruit To Volume Action (Wineries)
  - [ ] Create Receive Fruit Action (Wineries)
  - [ ] Create Addition Action (Wineries)
  - [ ] Create Lot (Wineries)
  - [ ] Partially Update Lot (Wineries)
  - [ ] Create Transfer Action (Wineries)
  - [ ] Create Vendor (Wineries)
  - [ ] Update Vendor (Wineries)
  - [ ] Partially Update Vendor (Wineries)
  - [x] Create Case Goods Adjustment (Wineries)
  - [x] Replay Shopify Orders (Wineries) — see [Replaying missed Shopify orders](#replaying-missed-shopify-orders)

- **Searches**

  - [ ] Get Personal Access Token by ID
  - [ ] Get Varietal by ID
  - [ ] Get Winery by ID
  - [x] Get Lot ID by Case Goods Name
  - [ ] Get Analysis Action by ID (Wineries)
  - [ ] Get Process Fruit To Volume Action by ID (Wineries)
  - [ ] Get Receive Fruit Action by ID (Wineries)
  - [ ] Get Addition Action by ID (Wineries)
  - [ ] Get Block by ID (Wineries)
  - [ ] Get Lot by ID (Wineries)
  - [ ] Get Components Summary (Wineries)
  - [ ] Get Transfer Action by ID (Wineries)
  - [ ] Get Vendor by ID (Wineries)
  - [ ] Get Vineyard by ID (Wineries)

### Replaying missed Shopify orders

The **Replay Shopify Orders** action records the bottled-wine removals for Shopify orders that the
"Shopify Paid Order => Remove Taxpaid" Zap missed (for example, runs Zapier held when the account hit its task limit).

For each order number it:

1. Reads the order from Shopify (Admin GraphQL API).
2. Skips the order unless it is paid (or partially refunded). Test, cancelled, voided, refunded and unpaid orders
   are never replayed.
3. Builds one adjustment per line-item SKU that starts with `CG-`, adding up the quantities the customer kept, so
   refunded or removed line items are not recorded as leaving. Tastings, merchandise and wine by the glass are ignored.
4. Finds the InnoVint lot whose **code exactly matches** the SKU (no fuzzy matching).
5. Skips any SKU InnoVint already has: the same lot, tax-paid removal, at the order's payment time. Anything on the
   same lot within two minutes of it is flagged as `possible_duplicate` for you to check rather than recorded.
6. Records the rest as `REMOVED_TAXPAID` with the order's Shopify payment time as the effective date, unless
   **Dry Run** is on (the default).

It returns a line-by-line result (`would_record`, `recorded`, `already_recorded`, `possible_duplicate`,
`lot_not_found`, `invalid_sku`, `error`). A real run that could not finish everything fails the Zap step, so a
missed removal cannot pass unnoticed; running it again skips whatever was already recorded. At most 10 orders per
run, to stay inside Zapier's action time limit.

**Safety switches.** _Dry Run_ and _Skip Lines Already in InnoVint_ are on unless the value is explicitly
`false`/`no`/`off`/`0`, so a mistyped or unmapped field can never turn a preview into a recording.

**Setup:** the action reads Shopify, so the InnoVint connection has two optional fields: _Shopify Store Domain_ and
_Shopify Admin API Access Token_. Create a custom app in Shopify admin (Settings > Apps > Develop apps) with the
`read_orders` and `read_all_orders` scopes (`read_all_orders` is needed for orders older than 60 days) and paste its
access token into the connection. Only a `myshopify.com` domain is accepted and redirects are never followed, so the
Shopify token can only ever reach Shopify; the InnoVint API key is only ever sent to innovint.us.

**Try it locally first (never records anything):**

```bash
# Add API_KEY, INNOVINT_WINERY_ID, SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN to .env
# (see .env.example for the names; do not overwrite an .env you already have).
npm run replay:dry-run -- 3495 3499 3501 3502
```

### Getting Started with Zapier

Sign up for a free [Zapier](https://zapier.com/) account, from there you
can jump right in. To help you hit the ground running, here are some popular pre-made Zaps.

### How do I connect Innovint to Zapier?

- Log in to your [Zapier account](https://zapier.com/sign-up) or create a new account. Navigate to "
  My Apps" from the top menu bar.
- Now click on "Connect a new account..." and search for "Innovint"
- Use your credentials to connect your Innovint account to Zapier.
- Once that's done you can start creating an automation!
- Use a pre-made Zap or create your own with the Zap Editor. Creating a Zap requires no coding
  knowledge and you'll be walked step-by-step through the setup.
- Need inspiration? See everything that's possible
  with [Innovint and Zapier](https://zapier.com/apps/Innovint/integrations).

## Seeking Assistance

If you find any problems or would like to suggest a feature, please read
the [How can I contribute](/CONTRIBUTING.md#how-can-i-contribute) section in our contributing
guidelines.

Need to report an Issues Innovint Zapier Integration or have any
questions? Open an [Issue](https://github.com/danshome/zapier-integration/issues)

## Contributing

If you want to contribute please read the [Contributing](/CONTRIBUTING.md) guidelines.

It's very easy to get started with these 3 steps:

- Clone this project to your local machine.
- Open terminal and cd into the cloned folder, usually `cd zapier-integration`.
- Run to install dependencies.

```shell
npm install
```

- Copy the variable names from `.env.example` into a `.env` file of your own and fill in your Innovint Personal
  API Token for tests. If you already have a `.env`, add the missing names to it rather than overwriting it.
- run the unit tests, which never touch a live API.

```shell
npm test
```

- the integration tests do talk to InnoVint, and the Case Goods Adjustment one records a real adjustment, so it
  only runs when you opt in with a test winery:

```shell
INNOVINT_ALLOW_TEST_WRITES=yes npm run test:integration
```

- run to push your local changes to your own Zapier account.

```shell
npm run deploy           # unit tests, lint, zapier-platform validate, then zapier-platform push
```

- make sure to increase `package.json` version when delivering your improvements, and add a matching entry to
  `CHANGELOG.md` (Zapier requires one to promote a version).

You might want to check a `z` object to see its methods. `z.console.log` stands for `console.log`
for example.

The Zapier CLI ships with this project as `zapier-platform` (run it with `npx zapier-platform`). Node.js 22.12 or newer is required; Node 22 is what the integration runs on at Zapier.

## Legal Disclaimer

This integration for Innovint Inc.'s API is independent and not affiliated with Innovint Inc.
Provided "as is" and at your own risk. **Caution: Use of internal APIs, even with Innovint Inc.'s
approval, could cause irreversible data damage.** [Read the full disclaimer here](./DISCLAIMERS.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
