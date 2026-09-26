"""Keep the lane tables in the guides equal to ``ci_plan.py render-table``.

The guides embed the generated table between two markers, so a rule change in
``tests/ci/ci_plan.py`` fails here until the documented table is regenerated.
To refresh a block, replace everything between the markers with the output of
``python tests/ci/ci_plan.py render-table``.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from tests.ci.ci_plan import render_table

ROOT = Path(__file__).resolve().parents[2]
BEGIN = "<!-- ci-lanes:begin -->\n"
END = "<!-- ci-lanes:end -->"
DOCUMENTS = (
    ".agents/ci/README.md",
    ".agents/testing/README.md",
)


def _block(relative: str) -> str:
    text = (ROOT / relative).read_text(encoding="utf-8")
    assert text.count(BEGIN) == 1, f"{relative} needs exactly one {BEGIN!r}"
    assert text.count(END) == 1, f"{relative} needs exactly one {END!r}"
    start = text.index(BEGIN) + len(BEGIN)
    end = text.index(END)
    assert start <= end, f"{relative} has its lane markers out of order"
    return text[start:end]


@pytest.mark.parametrize("relative", DOCUMENTS)
def test_lane_table_block_matches_render_table(relative: str) -> None:
    assert _block(relative) == render_table(), (
        f"{relative} lane table is stale; replace the block with the output "
        "of `python tests/ci/ci_plan.py render-table`"
    )


def test_render_table_cli_prints_render_table() -> None:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "tests/ci/ci_plan.py"), "render-table"],
        capture_output=True,
        check=True,
        cwd=ROOT,
        text=True,
    )
    assert completed.stdout == render_table()
