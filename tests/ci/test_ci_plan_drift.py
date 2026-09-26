"""Keep the lane rules in step with what the lane jobs actually read.

The rule table in ``ci_plan.py`` is only safe while every file a lane job
reads classifies to a plan that selects that lane.  These tests derive the
inputs from their sources instead of restating them:

* the archive producer's ``_SOURCE_INPUTS``, loaded from the producer itself;
* the programs the production jobs run, from ``ENTRY_POINTS`` and from the
  paths the job steps name in ``desktop-production.yml``;
* the repository files those packaging programs import and name, by loading
  them in a subprocess;
* the repository files the desktop jobs' pytest targets import, by collecting
  them in a subprocess;
* every tracked file, which must match an explicit rule unless it is on the
  allowlist below with a reason.

The sidecar import-closure test stays in ``test_ci_plan.py``.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType

import pytest
import yaml

from tests.ci.ci_plan import LANE_PRODUCTION_JOBS, RULES, classify_paths
from tests.ci.test_production_entry_points import ENTRY_POINTS

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE_PRODUCER = ROOT / "scripts/build_desktop_archive.py"
PRODUCTION_WORKFLOW = ROOT / ".github/workflows/desktop-production.yml"
PRODUCTION_PREFIX = "desktop-production.yml:"
#: The job runs ``pip install ./examples/desktop-plugin``, so collection of
#: its tests needs the example package importable.
EXAMPLE_PLUGIN_SOURCE = ROOT / "examples/desktop-plugin/src"
SYNTHETIC_CHILD = "ci-plan-drift-synthetic-child.txt"

#: Tracked paths deliberately left to the unmatched full-graph fallback,
#: mapped to the reason.  Every entry must be tracked and actually unmatched.
UNMATCHED_ALLOWLIST: dict[str, str] = {}

PACKAGING_JOBS = frozenset(
    PRODUCTION_PREFIX + job for job in LANE_PRODUCTION_JOBS["packaging"]
)
#: ``source-identity`` only reads git metadata, so it has no path inputs.
DESKTOP_JOBS = frozenset(
    PRODUCTION_PREFIX + job
    for job in LANE_PRODUCTION_JOBS["desktop"] - {"source-identity"}
)


def _tracked_files() -> list[str]:
    output = subprocess.run(
        ["git", "ls-files", "-z"],
        capture_output=True,
        cwd=ROOT,
        check=True,
    ).stdout.decode("utf-8")
    return [path for path in output.split("\0") if path]


TRACKED = frozenset(_tracked_files())


def _selects(path: str, lane: str) -> bool:
    lanes, _, _ = classify_paths([path])
    return lane in lanes


def _expand(relative: str) -> list[str]:
    """A tracked file, or a synthetic child plus every tracked file below it."""

    if relative in TRACKED:
        return [relative]
    prefix = relative.rstrip("/") + "/"
    below = sorted(path for path in TRACKED if path.startswith(prefix))
    if not below:
        return []
    return [prefix + SYNTHETIC_CHILD, *below]


def _offenders(paths: dict[str, str], lane: str) -> list[str]:
    offenders = []
    for path, source in sorted(paths.items()):
        lanes, _, _ = classify_paths([path])
        if lane not in lanes:
            offenders.append(f"{path} (from {source}) -> {sorted(lanes)}")
    return offenders


def _load_by_path(name: str, path: Path) -> ModuleType:
    specification = importlib.util.spec_from_file_location(name, path)
    assert specification is not None and specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    # Dataclasses resolve their module through sys.modules while executing.
    sys.modules[name] = module
    specification.loader.exec_module(module)
    return module


# (1) The archive producer's source inputs.


def _source_inputs() -> list[str]:
    producer = _load_by_path("ci_plan_drift_archive_producer", ARCHIVE_PRODUCER)
    return [Path(entry).as_posix() for entry in producer._SOURCE_INPUTS]


def test_every_archive_source_input_selects_packaging() -> None:
    inputs = _source_inputs()
    assert "src/tongs/__init__.py" in inputs
    paths: dict[str, str] = {}
    for entry in inputs:
        expanded = _expand(entry)
        assert expanded, f"_SOURCE_INPUTS names {entry}, which is not tracked"
        paths.update(dict.fromkeys(expanded, f"_SOURCE_INPUTS {entry}"))
    assert _offenders(paths, "packaging") == []


# (2) The programs the production jobs run, and what they read.


@pytest.fixture(scope="module")
def production_jobs() -> dict[str, dict]:
    document = yaml.safe_load(PRODUCTION_WORKFLOW.read_text())
    return {
        PRODUCTION_PREFIX + name: body
        for name, body in document["jobs"].items()
        if isinstance(body, dict) and "steps" in body
    }


def test_the_lane_jobs_exist_in_the_production_workflow(
    production_jobs: dict[str, dict],
) -> None:
    named = {
        PRODUCTION_PREFIX + job
        for jobs in LANE_PRODUCTION_JOBS.values()
        for job in jobs
    }
    assert named <= set(production_jobs), sorted(named - set(production_jobs))


def test_every_packaging_entry_point_selects_packaging() -> None:
    paths = {
        entry.program: f"ENTRY_POINTS {sorted(set(entry.jobs) & PACKAGING_JOBS)}"
        for entry in ENTRY_POINTS
        if set(entry.jobs) & PACKAGING_JOBS
    }
    assert paths, "no ENTRY_POINTS program runs in a packaging job"
    assert _offenders(paths, "packaging") == []


def test_every_desktop_entry_point_selects_desktop() -> None:
    paths = {
        entry.program: f"ENTRY_POINTS {sorted(set(entry.jobs) & DESKTOP_JOBS)}"
        for entry in ENTRY_POINTS
        if set(entry.jobs) & DESKTOP_JOBS
    }
    assert paths, "no ENTRY_POINTS program runs in a desktop job"
    assert _offenders(paths, "desktop") == []


def _step_tokens(job: dict) -> Iterator[tuple[str, str]]:
    """Yield ``(working directory, token)`` for every word of every run step."""

    for step in job["steps"]:
        directory = step.get("working-directory", ".")
        for token in (step.get("run") or "").split():
            yield directory, token.strip("\"'")


def _named_paths(job: dict) -> list[str]:
    """Tracked paths a job's steps name, resolved against each step's cwd."""

    found: set[str] = set()
    for directory, token in _step_tokens(job):
        if not token or "$" in token or token.startswith(("-", "/")):
            continue
        base = (ROOT / directory).resolve()
        if any(character in token for character in "*?["):
            candidates = list(base.glob(token))
        else:
            candidates = [base / token]
        for candidate in candidates:
            resolved = candidate.resolve()
            if not resolved.is_relative_to(ROOT) or resolved == ROOT:
                continue
            found.update(_expand(resolved.relative_to(ROOT).as_posix()))
    return sorted(found)


@pytest.mark.parametrize(
    ("jobs", "lane"), [(PACKAGING_JOBS, "packaging"), (DESKTOP_JOBS, "desktop")]
)
def test_every_path_a_lane_job_names_selects_its_lane(
    production_jobs: dict[str, dict], jobs: frozenset[str], lane: str
) -> None:
    paths: dict[str, str] = {}
    for label in sorted(jobs):
        named = _named_paths(production_jobs[label])
        assert named, f"{label} names no tracked path, so the probe is blind"
        paths.update(dict.fromkeys(named, label))
    assert _offenders(paths, lane) == []


_LOAD_PROBE = """
import importlib.util, json, pathlib, sys

root = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(root))
for index, program in enumerate(json.loads(sys.argv[2])):
    specification = importlib.util.spec_from_file_location(
        f"ci_plan_drift_program_{index}", root / program
    )
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
files, named = set(), set()
for module in list(sys.modules.values()):
    file = getattr(module, "__file__", None)
    if not file:
        continue
    path = pathlib.Path(file).resolve()
    if not path.is_relative_to(root) or ".venv" in path.relative_to(root).parts:
        continue
    files.add(path.relative_to(root).as_posix())
    for value in vars(module).values():
        if isinstance(value, str) and 0 < len(value) < 300 and "\\n" not in value:
            named.add(value)
print(json.dumps({"files": sorted(files), "named": sorted(named)}))
"""


def _packaging_programs() -> list[str]:
    programs = {
        entry.program for entry in ENTRY_POINTS if set(entry.jobs) & PACKAGING_JOBS
    }
    # desktop_production_expectations.py loads its adapters lazily per
    # subcommand, so name them from its own constants.
    expectations = _load_by_path(
        "ci_plan_drift_expectations",
        ROOT / "tests/ci/desktop_production_expectations.py",
    )
    for name in dir(expectations):
        value = getattr(expectations, name)
        if name.endswith("_PROGRAM") and isinstance(value, str):
            programs.add(value)
    return sorted(program for program in programs if program.endswith(".py"))


def test_everything_the_packaging_programs_import_or_name_selects_packaging() -> None:
    programs = _packaging_programs()
    assert "scripts/build_desktop_sbom.py" in programs
    completed = subprocess.run(
        [sys.executable, "-c", _LOAD_PROBE, str(ROOT), json.dumps(programs)],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=True,
        timeout=300,
    )
    report = json.loads(completed.stdout)
    assert "src/tongs/desktop/artifact_contract/__init__.py" in report["files"]
    paths = {path: "imported" for path in report["files"]}
    for value in report["named"]:
        if value.startswith(("/", ".")) or "/" not in value:
            continue
        for path in _expand(value.rstrip("/")):
            paths.setdefault(path, "named by a module constant")
    assert _offenders(paths, "packaging") == []


_COLLECT_PROBE = """
import contextlib, io, json, pathlib, sys
import pytest

root = pathlib.Path(sys.argv[1])
sys.path.insert(0, sys.argv[2])
output = io.StringIO()
with contextlib.redirect_stdout(output):
    status = pytest.main(
        ["--collect-only", "-q", "-p", "no:cacheprovider", *json.loads(sys.argv[3])]
    )
if status != 0:
    sys.stderr.write(output.getvalue())
    raise SystemExit(f"collection failed with {status}")
files = set()
for module in list(sys.modules.values()):
    file = getattr(module, "__file__", None)
    if not file:
        continue
    path = pathlib.Path(file).resolve()
    if path.is_relative_to(root) and ".venv" not in path.relative_to(root).parts:
        files.add(path.relative_to(root).as_posix())
print(json.dumps(sorted(files)))
"""


def _pytest_targets(job: dict) -> list[str]:
    targets = []
    for step in job["steps"]:
        words = (step.get("run") or "").split()
        if "pytest" not in words:
            continue
        for word in words[words.index("pytest") + 1 :]:
            if word.startswith("-") or "$" in word or word == "\\":
                continue
            targets.append(word)
    return targets


def test_everything_the_desktop_suites_import_selects_desktop(
    production_jobs: dict[str, dict],
) -> None:
    targets = sorted(
        {
            target
            for label in DESKTOP_JOBS
            for target in _pytest_targets(production_jobs[label])
        }
    )
    assert "tests/plugins" in targets
    completed = subprocess.run(
        [
            sys.executable,
            "-c",
            _COLLECT_PROBE,
            str(ROOT),
            str(EXAMPLE_PLUGIN_SOURCE),
            json.dumps(targets),
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
        timeout=300,
    )
    assert completed.returncode == 0, completed.stderr
    imported = json.loads(completed.stdout)
    assert "src/tongs/tui_services.py" in imported
    paths = {path: "imported by a desktop suite" for path in imported}
    assert _offenders(paths, "desktop") == []


# (3) Every tracked path matches an explicit rule.


def test_every_tracked_path_matches_an_explicit_rule() -> None:
    unmatched = sorted(
        path
        for path in TRACKED
        if path not in UNMATCHED_ALLOWLIST
        and not any(rule.matches(path) for rule in RULES)
    )
    assert unmatched == [], (
        f"add a rule for these paths or allowlist them with a reason: {unmatched}"
    )


def test_the_unmatched_allowlist_is_current() -> None:
    for path, reason in UNMATCHED_ALLOWLIST.items():
        assert reason.strip(), path
        assert path in TRACKED, f"{path} is allowlisted but not tracked"
        assert not any(rule.matches(path) for rule in RULES), (
            f"{path} is allowlisted but now matches a rule"
        )
        _, full, _ = classify_paths([path])
        assert full
