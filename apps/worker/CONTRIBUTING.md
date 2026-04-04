# Contributing to UptimeKit Worker

First off, thank you for considering contributing to UptimeKit! It's people like you that make UptimeKit such a great tool.

## How Can I Contribute?

### Reporting Bugs

* **Check the existing issues** to see if the bug has already been reported.
* If you can't find an open issue addressing the problem, **open a new one**.
* Include a **clear title and description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

* Open a new issue with the tag "enhancement".
* Provide a clear and detailed explanation of the proposed enhancement.
* Explain why this enhancement would be useful to most UptimeKit users.

### Pull Requests

1. Fork the repo and create your branch from `release`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Styleguide

### Go Styleguide

* All Go code should be formatted with `gofmt`.
* Follow the [Effective Go](https://golang.org/doc/effective_go.html) guidelines.

## Development Setup

1. Clone the repository: `git clone https://github.com/uptimekit/worker.git`
2. Install dependencies: `go mod download`
3. Run the worker: `go run ./cmd/worker`

---

Thank you for your contributions!
