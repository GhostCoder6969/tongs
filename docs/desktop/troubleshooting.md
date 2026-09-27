---
title: Troubleshooting
description: "Fix desktop app install, launch and recovery problems, message by message."
---

:::note[Beta]
The desktop app is a beta. Its known defects are listed on
[Known issues](/releases/known-issues/).
:::

Start with `status`. It reports the installation without changing it, and it
never downloads, repairs or removes anything:

```console
tongs desktop status
tongs desktop status --json
```

The `recovery` field in the JSON output names the state, and each state's next
step is in the [recovery states](/reference/desktop-lifecycle/#recovery-states)
table. The sections below start from the message you see.

## Status says cleanup is incomplete

Two messages look alike and need different commands.

```text
The per-user desktop installation can launch, but old payload cleanup is incomplete; run 'tongs desktop repair'.
```

The app still works. Run `tongs desktop repair` before the next install or
update. Until you do, `install` and `update` stop before downloading with
`Desktop payload cleanup is incomplete; run repair before installing another release.`

```text
Per-user desktop cleanup is incomplete; run 'tongs desktop uninstall' again.
```

An uninstall was interrupted. Run `tongs desktop uninstall` again.

## The installer refuses this environment

The desktop app is bound to one console script and interpreter, because the
menu entry has to keep working after the shell that installed it is gone.

```text
Desktop menu registration requires a persistent Python installation. Install Tongs with 'pipx install tongs' or 'python -m pip install --user tongs', then retry.
```

The command ran from a temporary environment, such as `uvx tongs`, which is
removed when the command exits. Install tongs into a virtual environment, with
`pipx`, with `pip install --user`, or system-wide, then run the desktop command
again from there.

```text
This desktop installation is bound to another Python environment; run repair to rebind it explicitly.
```

The desktop app was installed from a different persistent environment.
`install`, `update` and `repair --redownload` stop before downloading. Run
`tongs desktop repair` from the environment you want to keep; it rebinds the
installation on purpose rather than silently.

## The app will not launch

With nothing installed, `tongs desktop` exits with code 2 and prints
`No per-user desktop installation is active. Run 'tongs desktop install'.`
It never installs on its own.

Otherwise the launcher checks the bound environment and the payload before it
starts anything. It never falls back to `PATH` or the current directory, so a
message about the bound environment means that exact recorded path no longer
validates. Each of these messages ends with
`Run 'tongs desktop repair' from a persistent installation.`

| Message | Cause |
| --- | --- |
| `The bound Tongs Python environment changed or disappeared.` | The recorded console script or interpreter is gone or was replaced. |
| `The bound Tongs Python environment could not be validated.` | The environment exists but did not answer the identity check. |
| `The bound Tongs console script has an invalid interpreter.` | The console script's shebang does not name a usable interpreter. |
| `The bound Tongs core is incompatible with this desktop payload.` | The core version or its API majors are outside the payload's compatible range, which follows a core upgrade or downgrade. Run `tongs desktop update`. |
| `The installed desktop launcher is unsafe.` | The launcher inside the payload failed validation. |

Run `tongs desktop repair` from the intended environment first. Use
`tongs desktop repair --redownload` only when local recovery fails.

## The console script is rejected

Two console script problems cannot be fixed by repair, because repair rebinds
an environment and cannot rewrite a script that pip or pipx wrote. Reinstall
tongs into a supported layout instead of editing the script by hand.

```text
The bound Tongs console script must name one absolute Python interpreter path, followed only by the '-E' flag pipx adds. Install Tongs with 'pipx install tongs' or 'python -m pip install --user tongs', then retry.
```

The shebang has to name the interpreter without a `PATH` lookup. Accepted
forms are a plain absolute path such as `#!/usr/bin/python3`, the same path
followed by the `-E` flag that `pipx` adds, and the shell trampoline below.
`#!/usr/bin/env python3`, a relative path and any other flag are rejected,
because each can resolve to a different Python than the one the menu entry was
bound to. Only a space or a tab may separate the path from `-E`; other
whitespace is treated as part of the path and rejected.

```text
The bound Tongs console script's shell trampoline must exec one absolute Python interpreter path and no arguments. Install Tongs with 'pipx install tongs' or 'python -m pip install --user tongs', then retry.
```

When the environment path contains a space, pip and venv write a fixed
`/bin/sh` trampoline instead of a plain shebang, and tongs reads the
interpreter from that exact form. This message means the second line differs
from it: the `exec` preamble or trailing arguments differ, more than one value
is quoted, or the quoted interpreter is not an absolute path.

## Graphics and session

The beta supports Fedora 44 KDE on x86_64, running through XWayland. Native
Wayland, other desktop environments, other distributions and other
architectures are outside that support. The installer checks the platform
before it downloads, so an unsupported platform fails at install, not at
launch.

On a Wayland session, `tongs desktop` adds `--ozone-platform=x11` when it runs
on Linux with `WAYLAND_DISPLAY` set, and the RPM launcher always adds it. The
app refuses to start without it:

```text
Fedora KDE Wayland sessions must launch the desktop through XWayland
```

If you see this message, something other than `tongs desktop`,
`tongs-desktop` or the menu entry started the app.

Hardware GPU acceleration has not been verified for this beta. A headless,
container or software-rendered run says nothing about the accelerated path.

## An RPM is also installed

The per-user archive and the RPMs are independent. When both are present,
`status` selects the per-user installation and adds:

```text
A separate RPM installation is also present; this command selected the per-user installation.
```

This is information, not an error. `tongs desktop` starts the per-user app and
`tongs-desktop` starts the RPM app. See
[Coexisting with an RPM](/reference/desktop-lifecycle/#coexisting-with-an-rpm).

## The editor does not open

**Open log in editor** starts the configured graphical editor with a private,
bounded copy of the log. Known terminal-only editor commands are rejected,
because they cannot attach to the desktop window. Configure an editor command
that waits until you close the file, such as `code --wait` or `kate --block`. tongs
reports that the editor process started, which does not confirm that the
editor read the file. See the
[editor configuration reference](/reference/configuration/).
