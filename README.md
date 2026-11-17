# bot-customers

Bot customers that clone a public repository into a temporary directory, detect how to install and test it, run the tests with a time limit, and write a **lit** or **dark** report. The report is a job record that [staging-customers](https://github.com/fitzyracing1/staging-customers) can ingest and, when the job is lit, bill with test money.

This tool only reads public repositories. It never pushes, never comments, and never opens issues, discussions, or pull requests on anyone's repository — including yours.

Author: Joshua Almeida ([@fitzyracing1](https://github.com/fitzyracing1)). MIT.

## How it connects to discuss-build

[discuss-build](https://github.com/fitzyracing1/discuss-build) reads a repo's issues and discussions, builds concrete asks on a branch of the subscriber's own fork, and counts a build only once CI is lit. bot-customers is the companion a staging bot can use to clone and test software, then hand the lit/dark result to staging-customers.

The loop we want to prove with test money, before any real money is involved:

1. A staging customer is subscribed in [staging-customers](https://github.com/fitzyracing1/staging-customers).
2. discuss-build (or this tool) works on a public repo.
3. bot-customers writes `out/job.json` with a lit, dark, or untested result.
4. `staging-customers job ingest out/job.json` records the job, and `staging-customers bill` charges test money only for lit jobs.

Switching to real money later is a deliberate change that Joshua must OK. It is not part of this software.

## CLI

Zero runtime dependencies. Node ≥ 18.

```
bot-customers test owner/repo
bot-customers test --dir ./path/to/checkout
bot-customers detect --dir ./path/to/checkout
```

`--out` picks the report directory (default `out`). `--timeout-seconds` caps install and test (default 180). `--customer` attaches a staging-customers customer id to the job record. `--keep-work` leaves the temporary clone in place.

`test owner/repo` clones with unauthenticated HTTPS, after checking that the GitHub repository is public. Private repositories are refused. `test --dir` runs against a local directory and is what the tests use, so CI never needs the network.

## What it detects

In this order, when the files are present:

- **npm / pnpm / yarn** — a `package.json` with a `test` script. The lockfile chooses the package manager (`pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`). Install is skipped when there are no dependencies.
- **Rust** — `Cargo.toml` → `cargo test`
- **Go** — `go.mod` → `go test ./...`
- **Python** — pytest markers (`pytest.ini`, `conftest.py`, `pyproject.toml`, `tests/test_*.py`, and similar) → a local venv, then `pytest`
- **Make** — a `Makefile` (or `makefile`) with a `test` target → `make test`

If nothing matches, the result is **untested**. If install or tests fail, or the time limit is hit, the result is **dark**. If the tests exit 0, the result is **lit**.

Reports written to `--out`:

- `job.json` — the shared job record
- `report.md` — a short human-readable summary
- `logs.txt` — captured install and test output

## Job records

bot-customers and staging-customers share a JSON job-record schema named `discuss-build-job/v0.1`. The same schema is documented in the [staging-customers README](https://github.com/fitzyracing1/staging-customers).

```json
{
  "schema": "discuss-build-job/v0.1",
  "id": "job_01example",
  "customerId": "cust_01example",
  "subscriptionId": null,
  "source": "bot-customers",
  "repo": "owner/repo",
  "issue": {
    "number": null,
    "url": null,
    "title": "test run of owner/repo",
    "type": "test-run"
  },
  "branch": null,
  "result": "lit",
  "billed": false,
  "billId": null,
  "amount": null,
  "logsSummary": "npm test exited 0",
  "startedAt": "2026-11-17T03:00:00.000Z",
  "finishedAt": "2026-11-17T03:01:00.000Z",
  "tester": {
    "tool": "bot-customers",
    "version": "0.1.0",
    "method": "npm test"
  },
  "createdAt": "2026-11-17T03:01:00.000Z"
}
```

Ingest that file with:

```
staging-customers job ingest out/job.json --customer cust_...
```

## Safety

- Only public GitHub repositories are cloned, over unauthenticated HTTPS, with `--depth 1`.
- The tool never runs `git push`.
- The tool never comments, and never opens issues, discussions, or pull requests.
- A temporary clone is deleted when the run finishes, unless you pass `--keep-work`.

## Tests

`npm test` runs the offline suite against tiny local fixtures. CI does not use the network. CI is the `test` workflow on push and pull request.

## License

MIT. Copyright (c) 2026 Joshua Almeida.
