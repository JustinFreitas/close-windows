# Close Windows

A Fantasy Grounds extension (FGC/FGU) that closes all the windows you've opened, optionally leaving some of the common windows open.

## Features

Close all windows you've opened, optionally leaving some of the common windows open:

- Character Sheets (`charsheet`)
- Combat Tracker (CT, including starship/ruleset variants)
- Party Sheet (PS)
- Image & Picture windows (`imagewindow`, `picture`)
- Reference Manuals / Books (`reference_manual`)
- Sound Context window (`sound_context`)
- Timer extension window (`timerwindow`)

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
| Keep Char Sheets Open | Leaves Character Sheet (`charsheet`) windows open |
| Keep CT Open | Leaves the Combat Tracker open |
| Keep Images Open | Leaves Image and Picture windows open |
| Keep PS Open | Leaves the Party Sheet open |
| Keep Books Open | Leaves Reference Manuals / Books (`reference_manual`) open |
| Keep Sound Open | Leaves the Sound: Context (`sound_context`) window open |
| Keep Timer Open | Leaves the Timer extension window open |

All options default to **off** (everything closes).

## Compatibility & Architecture

- **Unified Codebase**: Single `.ext` package works on both Fantasy Grounds Unity (FGU) and Fantasy Grounds Classic (FGC).
- **CoreRPG & Derived Rulesets**: Full support for 2E, 3.5E, 4E, 5E, PFRPG, PFRPG2, SFRPG, MGT2, SavageWorlds, OSE2, etc.
- **FGU Native Engine**: Uses native `Interface.getWindows()` for zero-overhead, instant window queries with no persistent memory tracking or stale handles.
- **Tabletop Safety**: Automatically preserves desktop panels (`w.isPanel()`), `<noclose />` HUD/ruleset windows (e.g., AD&D 2E dropdown menus, PFRPG2 DC widget, SavageWorlds tools), and pending manual dice rolls (`manualrolls`).
- **Transient Window State**: Uses `<placement><nosave /></placement>` on the trigger window class and `onLinkActivate` handling so `closewindows` never pollutes campaign `windowstate.xml`.
- **FGC Fallback**: Maintains backward compatibility on Classic using `openWindowList` (`Interface.onWindowOpened`) with automatic `pcall` dead-userdata pruning on window open and close.

## Changelog

### v1.4 — 10/25/26
- **New Keep-Open Options**: Added per-user options for **Keep Char Sheets Open** (`charsheet`), **Keep Books Open** (`reference_manual`), and **Keep Sound Open** (`sound_context`), plus legacy `picture` support under **Keep Images Open**.
- **Ruleset Variant Coverage**: Expanded Combat Tracker and Party Sheet matching to cover ruleset variants (`combattracker_host_ship`, `shipcombattracker_client`, `ct_ship_combat`, `partysheet`, `partysheet_host1`, etc.) and restored AD&D 2E menu refresh (`MenuManager.menusWindow.createMenuSelections`).
- **Refined Window Exclusions**: Added `<noclose />` (`w.noclose`) and AD&D 2E dropwindow protection while allowing closable popup dialogs (such as 5E's Spell Migration prompt) to close normally.
- **Transient Trigger Handling**: Added `<placement><nosave /></placement>` to `closewindows` and registered an `onLinkActivate` handler so hotbar/sidebar triggers never write dummy state to `windowstate.xml`.
- **Resilience & FGC Pruning**: Added `pcall` fault tolerance in FGU's close loop and automatic dead-handle pruning inside FGC's `onWindowOpened`.

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
