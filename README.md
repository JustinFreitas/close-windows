# Close Windows

A Fantasy Grounds extension (FGC/FGU) that closes all the windows you've opened, optionally leaving some of the common windows open.

## Features

Close all windows you've opened, optionally leaving some of the common windows open:

- Combat Tracker (CT)
- Party Sheet (PS)
- Image windows
- Timer extension window

Works on both **host/DM** and **client/player**, with each side able to tailor its own settings independently.

## Usage

There are several ways to trigger a close-all:

- **Chat command:** type `/cw` or `/closewindows`. You can also drag the command to the hotbar for one-click access.
- **FGC (Classic):** click the **Close All** button in the right dock near the bottom.
- **FGU (Unity):** click the **X** sidebar button at the top.

## Options

Each of the following can be toggled on/off under **Options → Close Windows** (per host and per client):

| Option | Effect when ON |
| --- | --- |
| Keep CT Open | Leaves the Combat Tracker open |
| Keep PS Open | Leaves the Party Sheet open |
| Keep Images Open | Leaves image windows open |
| Keep Timer Open | Leaves the Timer extension window open |

All options default to **off** (everything closes).

## Compatibility & Architecture

- **Unified Codebase**: Single `.ext` package works on both Fantasy Grounds Unity (FGU) and Fantasy Grounds Classic (FGC).
- **CoreRPG & Derived Rulesets**: Full support for 2E, 3.5E, 4E, 5E, PFRPG, PFRPG2, SFRPG, SavageWorlds, OSE2, etc.
- **FGU Native Engine**: Uses native `Interface.getWindows()` for zero-overhead, instant window queries with no persistent memory tracking or stale handles.
- **Tabletop Safety**: Automatically preserves desktop panels (chat window, dice tower, modifier stack, sidebar, background map panel) and modal dialogs (`dialog_okcancel`, `prompt`, `colorpicker`).
- **FGC Fallback**: Maintains backward compatibility on Classic using `openWindowList` wrapped with `pcall` dead-userdata protection.

## Changelog

### v1.3 — 9/14/26
- **Unified Architecture**: Merged FGU and FGC into a single cross-compatible codebase with automatic runtime feature detection (`Interface.getWindows`).
- **FGU Native Window Query**: Leverages `Interface.getWindows()` in Unity, completely eliminating window tracking lists, memory leaks, and stale object references.
- **Panel & Dialog Protection**: Added `w.isPanel()` protection to prevent closing tabletop panels or background maps, and protected confirmation prompts/dialogs (`dialog_okcancel`, `prompt`, `colorpicker`, `manualrolls`).
- **FGC Hardening**: Wrapped FGC fallback tracking in `pcall` to safely discard dead userdata without throwing script errors if windows were closed manually.
- **Automated Test Suite**: Added comprehensive wasmoon unit tests covering both FGU and FGC execution modes.

### v1.2 — 6/9/26
- Track window closes on FGC so the internal open-window list no longer grows unbounded or retains stale handles.
- Chain to the original FGC window handlers even for nil windows.
- Minor cleanup and clarifying comments.

### v1.1 — 2/12/24
- Added Timer extension window to the keep-open options.

## Author

Justin Freitas — © 2023–2026
