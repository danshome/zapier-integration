# Contributing

:tada: First off, thanks for taking the time to contribute! :tada:

The following is a set of guidelines for contributing to Zapier Innovint Connector. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

This project and everyone participating in it are governed by the [Code of Conduct](/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How can I contribute?

### Star this repo

It's quick and goes a long way! :stars:

### Reporting Bugs

This section guides you through submitting a bug report for Innovint Zapier Integration. Following these guidelines helps maintainers, and the community understand your report :pencil:, reproduce the behavior :computer:, and find related reports :mag_right:.

When you are creating a bug report, please include as many details as possible.

#### How Do I Submit a Bug Report?

Bugs are tracked as [GitHub issues](https://github.com/danshome/zapier-integration/issues/).

Explain the problem and include additional details to help reproduce the problem:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible. Don't just say what you did, but explain how you did it.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**

Include details about your environment.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Innovint Zapier Integration. Following these guidelines helps maintainers and the community understand your suggestion :pencil: and find related suggestions :mag_right:.

When you are creating an enhancement suggestion, please include as many details as possible.

#### How Do I Submit an Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://github.com/danshome/zapier-integration/issues/).

Create an issue on that repository and provide the following information:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most Zapier Integration users.

### Your First Code Contribution

Unsure where to begin contributing to Innovint Zapier Integration? You can start by looking through these `good-first-issue` and `help-wanted` issues:

* [Good first issue](https://github.com/danshome/zapier-integration/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) - issues which should only require a small amount of code, and a test or two.
* [Help wanted](https://github.com/danshomet/zapier-integration/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) - issues which should be a bit more involved than `Good first issue` issues.

#### Pull Request Checklist

Before sending your pull requests, make sure you followed the list below:

- Read these guidelines.
- Read [Code of Conduct](/CODE_OF_CONDUCT.md).
- Ensure that your code adheres to standard conventions, as used in the rest of the project.
- Ensure that there are unit tests for your code.
- Run unit tests.

##### Running tests

Integrators will first need an InnoVint user account to access the APIs. To have an account created, reach out to the support team at support@innovint.us .

Once the account is created, integrators should request winery administrators to grant the user account access to the necessary wineries. All wineries have a unique ID that should be used in API calls. Some accounts may have multiple wineries, so integrators will need access to all of the wineries. Once access is granted, the IDs of all accessible wineries can be retrieved using the List Wineries API.
To run tests you need an account in [Innovint](https://sutter.innovint.us/api/v1/docs/)

1. Generate a new Personal Access Token in your Account Settings
2. Create a new Innovint project or just use an existing one
3. Setup environment variables:

    ```console
    cp .env.example .env
    ```

   Fill in the `.env` variables with your credentials.

4. Run tests:

    ```console
    npm run test
    ```

#### Philosophy of code contribution

- Include unit tests when you contribute new features, as they help to a) prove that your code works correctly, and b) guard against future breaking changes to lower the maintenance cost.
- Bug fixes also generally require unit tests, because the presence of bugs usually indicates insufficient test coverage.