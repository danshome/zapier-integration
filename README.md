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
[**`Docs`**](https://support.innovint.us/zapier) &nbsp;|&nbsp;
[**`Innovint Support`**](https://support.innovint.us/)

</div>

<div style="text-align: center;">

<a href="https://zapier.com/apps/Innovint/integrations"><img src="https://img.shields.io/badge/dynamic/json?label=Zapier&amp;query=%24.version&amp;url=https%3A%2F%2Fraw.githubusercontent.com%2Fdanshome%2Fzapier-integration%2Fmain%2Fpackage.json&amp;logo=zapier" alt="Zapier"></a>
<a href="https://github.com/danshome/zapier-integration/actions/workflows/tests.yml"><img src="https://github.com/danshome/zapier-integration/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
<a href="https://github.com/danshome/zapier-integration/graphs/contributors"><img src="https://img.shields.io/github/contributors/danshome/zapier-integration?cacheSeconds=10001" alt="GitHub contributors"></a>
<a href="https://github.com/danshome/zapier-integration/blob/master/LICENSE"><img src="https://img.shields.io/github/license/danshome/zapier-integration?cacheSeconds=3600" alt="License"></a>

</div>

## Getting started

### Integration

This integration contains the following triggers, actions, and searches:

- **Triggers for Dropdown Fields**

  - List Analysis Types
  - List Appellations
  - List Dry Good Types
  - List Varietals
  - [x] List Wineries
  - List Winery Actions
  - List Blocks (Wineries)
  - List Bonds (Wineries)
  - List Vendors (Wineries)
  - List Vessels (Wineries)
  - List Vineyards (Wineries)

- **Other Triggers**

  - List Personal Access Tokens
  - List Analysis Actions (Wineries)
  - List Process Fruit To Volume Actions (Wineries)
  - List Receive Fruit Actions (Wineries)
  - List Addition Actions (Wineries)
  - List Additive Snapshots (Wineries)
  - List Additive Indicators (Wineries)
  - List Lots (Wineries)
  - List Lot Additive Snapshot (Wineries)
  - List Lot Block Components (Wineries)
  - List Transfer Actions (Wineries)

- **Actions**

  - Create Personal Access Token
  - Create Analysis Action (Wineries)
  - Create Process Fruit To Volume Action (Wineries)
  - Create Receive Fruit Action (Wineries)
  - Create Addition Action (Wineries)
  - Create Lot (Wineries)
  - Partially Update Lot (Wineries)
  - Create Transfer Action (Wineries)
  - Create Vendor (Wineries)
  - Update Vendor (Wineries)
  - Partially Update Vendor (Wineries)

- **Searches**
  - Get Personal Access Token by ID
  - Get Varietal by ID
  - Get Winery by ID
  - Get Analysis Action by ID (Wineries)
  - Get Process Fruit To Volume Action by ID (Wineries)
  - Get Receive Fruit Action by ID (Wineries)
  - Get Addition Action by ID (Wineries)
  - Get Block by ID (Wineries)
  - Get Lot by ID (Wineries)
  - Get Components Summary (Wineries)
  - Get Transfer Action by ID (Wineries)
  - Get Vendor by ID (Wineries)
  - Get Vineyard by ID (Wineries)

### Getting Started with Zapier

Sign up for a free [Zapier](https://zapier.com/apps/Innovint/integrations) account, from there you
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

Need help working with Innovint Zapier Integration or have any
questions? [Contact](https://Innovint.com/contacts) Customer Success Service.

## Contributing

If you want to contribute please read the [Contributing](/CONTRIBUTING.md) guidelines.

It's very easy to get started with these 3 steps:

- Clone this project to your local machine.
- Open terminal and cd into the cloned folder, usually `cd zapier-integration`.
- Run to install dependencies.

```shell
npm install
```

- `cp .env.example .env` and put your Innovint OAuth credentials and Personal API Token for tests.
- run to run local tests and see if you are ready to proceed with development.

```shell
zapier test
```

- run to push your local changes to your own Zapier account.

```shell
zapier push
```

- make sure to increase `package.json` version when delivering your improvements.

You might want to check a `z` object to see it's methods. `z.console.log` stands for `console.log`
for example.

Note that you will need additional a `zapier` CLI installed.

## Legal Disclaimer

This integration for Innovint Inc.'s API is independent and not affiliated with Innovint Inc.
Provided "as is" and at your own risk. **Caution: Use of internal APIs, even with Innovint Inc.'s
approval, could cause irreversible data damage.** [Read the full disclaimer here](./DISCLAIMERS.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
