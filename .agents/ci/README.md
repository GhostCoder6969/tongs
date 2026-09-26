# CI and releases

Reference for maintainers and for contributors who want to know what CI runs.
The everyday contributor workflow is in [CONTRIBUTING.md](../../CONTRIBUTING.md);
this guide covers the full check set, the hosted workflows, releases, and what
to do when a hosted check fails.

## Full local check set


Run Python tools through the checkout-local environment:

```bash
source .venv/bin/activate
pytest tests/ --ignore=tests/test_mcp -v
pytest tests/test_mcp -v --junitxml="/tmp/tongs-mcp-$$.junit.xml"
python tests/ci/verify_desktop_ci.py mcp-report \
  --path "/tmp/tongs-mcp-$$.junit.xml"
ruff check src/ tests/
ruff format --check src/ tests/
```

The MCP extra is required so MCP tests execute rather than skip on import. The
`$$` in the report path keeps concurrent worktrees from overwriting each other's
report; CI uses `"$RUNNER_TEMP/mcp-<python-version>.junit.xml"` for the same
reason. Use a focused path during development, then run the checks appropriate to
the changed source.

## Desktop and other suites

Install, build, type-check, and test the production Electron/React shell with:

```bash
npm ci --prefix desktop
npm run build --prefix desktop
TONGS_TEST_PYTHON="$(command -v python)" npm test --prefix desktop
```

`npm run build --prefix desktop` prepares assets, runs TypeScript checking, and
creates build output. The test command repeats that build before the Electron
and renderer test suites. The historical comparison fixtures have separate checks:

```bash
PYTHONPATH=spikes/desktop pytest spikes/desktop/tests/test_backend.py -v
npm ci --prefix spikes/desktop/frontend
npm test --prefix spikes/desktop/frontend
npm run build --prefix spikes/desktop/frontend
pytest spikes/desktop/electron/test/test_launcher.py -v
npm ci --prefix spikes/desktop/electron
TONGS_DESKTOP_PYTHON="$(command -v python)" \
  npm test --prefix spikes/desktop/electron
```

Install `./spikes/desktop/reference-plugin` in the same Python environment before
running fixture tests that discover it. The installable production provider example has focused Python and prebuilt ESM
checks:

```bash
python -m pip install ./examples/desktop-plugin
python -m pytest -q examples/desktop-plugin/tests/test_provider.py
node --test examples/desktop-plugin/tests/test_dashboard_module.mjs
```

See the example [README](../../examples/desktop-plugin/README.md) for its declared
modules, resources, and same-environment installation contract.

The Fedora RPM sources have source-level checks that invoke no DNF, Podman, RPM,
Cargo, or network operation:

```bash
.venv/bin/pytest tests/packaging/rpm/desktop tests/test_plugins/test_plugin_system.py -q
.venv/bin/ruff check packaging/rpm/desktop tests/packaging/rpm/desktop src/tongs/mcp/plugin.py
.venv/bin/pytest tests/packaging/rpm/python-dependencies -v
```

Documentation changes build the site strictly:

```bash
mkdocs build --strict
```

## Hosted workflows

Pull requests to `main` and `feat/desktop-app` run `.github/workflows/ci.yml`.
Its required `Desktop pre-merge aggregate` accepts an exact revision only when
Ruff, Python 3.12 and 3.13 core/MCP tests, desktop fixture and production shell
tests, and the Fedora 44 Podman probe succeed. A skipped, cancelled, missing, or
failed required job fails the aggregate. A new commit supersedes earlier
results.

`ci.yml` is not the only workflow a `feat/desktop-app` pull request triggers.
One more runs on that base:

| Workflow | Trigger |
|---|---|
| `release-desktop.yml` (Unpublished desktop candidate attestation) | PRs into `feat/desktop-app` matching its path filter; pushes to either of its two named branches, `feat/desktop-app` and `feat/desktop-120-candidate-attestation`; pushes of a stable `vX.Y.Z` tag; and a manual `workflow_dispatch` dry run |

`desktop-rpm.yml` (Desktop Fedora RPM), `desktop-python-rpms.yml` (Desktop Python
companion RPMs) and `desktop-archive.yml` (Reproducible desktop archive) are manual
only (`workflow_dispatch`); the production gate's `rpm-lifecycle` and `archive` jobs
prove the same source rebuild, companion closure, lifecycle and byte-identical
rebuild against the receipt-bound fresh archive on every pull request.

`docs.yml` runs `mkdocs build --strict` and deploys the site to GitHub Pages,
but only on a push to `main` or a manual `workflow_dispatch`. No pull-request
check builds the documentation, which is why the strict build belongs in your
local run.

## Releases

Two workflows run on a stable `vX.Y.Z` tag. `publish.yml` builds the core
and publishes it to PyPI. `release-desktop.yml` builds the desktop archive for
that version, attests it with GitHub-managed Sigstore, verifies the attestation
with the installer's own code path, rebuilds the Fedora RPMs from the signed
archive, and publishes everything to the GitHub Release of the same tag,
created as a draft and published only after every asset is confirmed. Its
`release-publish` job is the only job in the repository holding
`contents: write`. The two workflows do not wait for each other, so a core
version can be on PyPI before its desktop release exists; the installer reports
that state and asks for a retry.

A `workflow_dispatch` of `release-desktop.yml` with `dry_run` set runs the
build, signing, verification and RPM rebuild on a branch and publishes nothing.
It is the rehearsal to run before pushing a tag. `tests/ci/test_release_publication_workflow.py`
pins the trigger, permission and step-order contract.

## Pinned actions and tools

Every GitHub Action referenced from a workflow under `.github/workflows` is
pinned to a full commit SHA with a trailing `# vX.Y.Z` comment, never a mutable
tag; `tests/ci/test_production_workflow_contract.py` enforces this for every
job- and step-level reference in every workflow, with no exceptions. The
documentation toolchain (`mkdocs`, `mkdocs-material`) is pinned to an exact
version in `pyproject.toml`'s `dev` extra, and a test asserts `docs.yml`'s
install step matches it; other tools a workflow installs ad hoc, such as
`build` and `ruff`, are not yet pinned and are tracked by #162. Updates to
these pins will arrive as Dependabot pull requests once #162 (v1.1.0) lands;
until then, bump them by hand.

## Re-running a hosted check

**Download the evidence you need before you re-run anything.** Every gate
artifact is named with the run id and the run attempt, and re-running all jobs
starts a new attempt and drops the artifacts the previous attempt produced.
Once a re-run has started, the evidence that would have explained the failure
may already be gone.

**A partial re-run fails closed, by design.** Re-running only the failed jobs
does not re-run the jobs that passed, so those jobs never upload artifacts under
the new attempt number, and `Desktop pre-merge aggregate` cannot download the
complete receipt set it requires. That is intended: the aggregate asserts that
one attempt produced every receipt for one revision. To get a green aggregate,
re-run all jobs or push a new commit.

**Never retry a flaky gate blindly.** A test that passes on the second attempt
is a defect in the test, and this repository fixes it rather than rolling the
dice: see #210, #215 and #218, each of which was a real ordering bug in an
assertion that sampled state before it had settled. File the flake, fix the
test, and say in the pull request which one it was. A re-run used to get past a
red check without an explanation is not acceptable evidence.

## Fedora harness and release boundaries

The Fedora harness interface is:

```bash
tests/containers/run-fedora-44.sh --output-dir <empty-directory-outside-checkout>
```

The production desktop release assembly gate is still separate from this
pre-merge aggregate. Do not describe a fixture, Podman, or headless Node run as
native Fedora, GPU, installer, signing, RPM, or release acceptance.

## Local Node limits

For local Node work, bound the whole process tree, not only the V8 heap. Run
the command inside a `systemd-run --user` unit with a 1 GiB memory limit, zero
swap, a 64-task limit, `NODE_OPTIONS=--max-old-space-size=512`,
`node --test --test-concurrency=1`, and an external deadline. Assert those
effective limits from inside the guard before starting Node, and fail on a
timeout or an out-of-memory termination rather than reporting the wrapper's exit
status. See the [testing guide](../testing/README.md) for the exact
`systemd-run` invocation and the native evidence rules.

Two rules exist because breaking them has repeatedly exhausted a developer's
machine:

- **Never assert on a DOM node.** Deep-equality and failure formatting walk
  jsdom objects recursively and allocate outside V8, so a single failing
  assertion can pass 1 GiB before the runner reports anything. Assert primitive
  values: text, attributes, counts, serialized payloads, and numeric rectangle
  coordinates.
- **Never run a scratch negative control against reverted source.** Reviewers
  verifying that a test would have caught a bug must reason from the diff and
  the test, not rebuild the shell in a throwaway worktree with the fix removed.
  Those runs are unbounded by construction, they duplicate a suite that already
  ran in CI, and they are the usual cause of an out-of-memory kill.
