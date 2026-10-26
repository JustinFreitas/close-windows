const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { LuaFactory } = require('wasmoon');

async function runTests() {
    console.log("Setting up Lua VM via wasmoon...");
    const luaFactory = new LuaFactory();
    const lua = await luaFactory.createEngine();

    console.log("Mocking Fantasy Grounds environment globals...");
    lua.doStringSync(`
        Interface = {}
        OptionsManager = {}
        Comm = { slashHandlers = {} }
        DesktopManager = {}
        MenuManager = {
            menuSelectionsRebuilt = false,
            menusWindow = {
                createMenuSelections = function()
                    MenuManager.menuSelectionsRebuilt = true
                end
            }
        }

        local major, minor, patch = 5, 1, 13
        function Interface.getVersion()
            return major, minor, patch
        end
        function Interface.setVersion(ma, mi, pa)
            major, minor, patch = ma, mi, pa
        end

        Interface.getString = function(s) return s end
        Interface.keyedHandlers = {}
        function Interface.addKeyedEventHandler(sEvent, sKey, fn)
            Interface.keyedHandlers[sEvent .. ":" .. sKey] = fn
        end

        local options = {}
        function OptionsManager.registerOption2(sKey, bLocal, sGroup, sLabel, sType, tCustom)
            if tCustom and tCustom.default then
                options[sKey] = tCustom.default
            end
        end
        function OptionsManager.isOption(key, val)
            return options[key] == val
        end
        function OptionsManager.setOption(key, val)
            options[key] = val
        end

        function DesktopManager.registerSidebarToolButton() end
        function DesktopManager.registerDockShortcut2() end
        function Comm.registerSlashHandler(sCmd, fn)
            Comm.slashHandlers[sCmd] = fn
        end

        local original_type = _G.type
        _G.type = function(v)
            if original_type(v) == "table" and v.sClass ~= nil then
                return "windowinstance"
            end
            return original_type(v)
        end

        function createMockWindow(sClass, bIsPanel, bDead, bNoClose)
            local win = {}
            win.sClass = sClass or "windowinstance"
            win.closed = false
            win.bPanel = bIsPanel or false
            win.bDead = bDead or false
            win.noclose = bNoClose or nil

            function win.isPanel()
                return win.bPanel
            end

            function win.getClass()
                if win.bDead then
                    error("invalid windowinstance: Object has been deleted")
                end
                return win.sClass
            end

            function win.close()
                if win.bDead then
                    error("invalid windowinstance: Object has been deleted")
                end
                win.closed = true
            end

            return win
        end
    `);

    console.log("Loading scripts/closewindows.lua into VM...");
    const luaCodePath = path.join(__dirname, '../scripts/closewindows.lua');
    const luaCode = fs.readFileSync(luaCodePath, 'utf8');

    // Make local variables accessible for testing
    const luaCodeModified = luaCode
        .replace('local openWindowList = {};', 'openWindowList = {};');
    lua.doStringSync(luaCodeModified);
    console.log("CloseWindows loaded successfully inside VM.\n");

    let testsPassed = 0;
    let testsFailed = 0;

    async function runAssert(fnName, expected, luaCodeToRun) {
        try {
            const result = lua.doStringSync(luaCodeToRun);
            assert.strictEqual(result, expected);
            console.log(`  ✓ PASS: ${fnName} -> got ${result}`);
            testsPassed++;
        } catch (err) {
            console.error(`  ✗ FAIL: ${fnName} -> expected ${expected}, got error or mismatch: ${err.message}`);
            testsFailed++;
        }
    }

    console.log("=== SUITE 0: XML Definition Integrity ===");
    const closeWindowsXml = fs.readFileSync(path.join(__dirname, '../campaign/closewindows.xml'), 'utf8');
    if (/<placement>\s*<nosave\s*\/>\s*<\/placement>/.test(closeWindowsXml)) {
        console.log("  ✓ PASS: campaign/closewindows.xml includes <placement><nosave /></placement>");
        testsPassed++;
    } else {
        console.error("  ✗ FAIL: campaign/closewindows.xml missing <placement><nosave /></placement>");
        testsFailed++;
    }

    const extensionXml = fs.readFileSync(path.join(__dirname, '../extension.xml'), 'utf8');
    const expectedLabels = [
        'option_label_CLOSEWINDOWS_KEEP_CS_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_CT_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_IMAGES_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_PS_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_REF_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_SOUND_OPEN',
        'option_label_CLOSEWINDOWS_KEEP_TIMER_OPEN'
    ];
    for (const label of expectedLabels) {
        if (extensionXml.includes(`name="${label}"`)) {
            console.log(`  ✓ PASS: extension.xml defines string ${label}`);
            testsPassed++;
        } else {
            console.error(`  ✗ FAIL: extension.xml missing string ${label}`);
            testsFailed++;
        }
    }

    console.log("\n=== SUITE 1: FGU Mode (Interface.getWindows) ===");

    // Set up FGU environment: Interface.getWindows is a function
    lua.doStringSync(`
        activeWindows = {}
        function Interface.getWindows()
            return activeWindows
        end

        onInit()
        onTabletopInit()
    `);

    // Verify IS_FGC detected as false in FGU, slash commands registered, and 2E MenuManager refreshed
    await runAssert("IS_FGC is false in FGU", false, "return IS_FGC");
    await runAssert("/cw slash command registered", "function", "return type(Comm.slashHandlers['cw'])");
    await runAssert("/closewindows slash command registered", "function", "return type(Comm.slashHandlers['closewindows'])");
    await runAssert("2E MenuManager.menusWindow.createMenuSelections refreshed", true, "return MenuManager.menuSelectionsRebuilt");
    await runAssert("onLinkActivate handler registered for closewindows", "function", "return type(Interface.keyedHandlers['onLinkActivate:closewindows'])");

    // Nil / non-string parameter guards
    await runAssert("isCombatTrackerClass(nil) returns false safely", false, "return isCombatTrackerClass(nil)");
    await runAssert("isPartySheetClass(nil) returns false safely", false, "return isPartySheetClass(nil)");
    await runAssert("isImageClass(nil) returns false safely", false, "return isImageClass(nil)");
    await runAssert("isExcludedClass(nil) returns true safely", true, "return isExcludedClass(nil)");
    await runAssert("shouldKeepWindowOpen(nil) returns false safely", false, "return shouldKeepWindowOpen(nil)");

    // Option checks: keepCsOpen (Character Sheets)
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CS_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('charsheet') option off", false, "return shouldKeepWindowOpen('charsheet')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CS_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('charsheet') option on", true, "return shouldKeepWindowOpen('charsheet')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CS_OPEN', 'off')");

    // Option checks: keepCtOpen (including ruleset variants)
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('combattracker_host') option off", false, "return shouldKeepWindowOpen('combattracker_host')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('combattracker_host') option on", true, "return shouldKeepWindowOpen('combattracker_host')");
    await runAssert("shouldKeepWindowOpen('combattracker_client') option on", true, "return shouldKeepWindowOpen('combattracker_client')");
    await runAssert("shouldKeepWindowOpen('combattracker_host_ship') SFRPG option on", true, "return shouldKeepWindowOpen('combattracker_host_ship')");
    await runAssert("shouldKeepWindowOpen('shipcombattracker_client') SFRPG/MGT2 option on", true, "return shouldKeepWindowOpen('shipcombattracker_client')");
    await runAssert("shouldKeepWindowOpen('ct_ship_combat') MGT2 option on", true, "return shouldKeepWindowOpen('ct_ship_combat')");
    await runAssert("shouldKeepWindowOpen('charsheet') CT option on", false, "return shouldKeepWindowOpen('charsheet')");

    // Option checks: keepPsOpen (including CoreRPG base 'partysheet' and ruleset variants)
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_PS_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('partysheet_host') option off", false, "return shouldKeepWindowOpen('partysheet_host')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_PS_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('partysheet') CoreRPG base option on", true, "return shouldKeepWindowOpen('partysheet')");
    await runAssert("shouldKeepWindowOpen('partysheet_host') option on", true, "return shouldKeepWindowOpen('partysheet_host')");
    await runAssert("shouldKeepWindowOpen('partysheet_client') option on", true, "return shouldKeepWindowOpen('partysheet_client')");
    await runAssert("shouldKeepWindowOpen('partysheet_host1') SDL option on", true, "return shouldKeepWindowOpen('partysheet_host1')");

    // Option checks: keepImagesOpen (including 'imagewindow' and legacy 'picture')
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('imagewindow') option off", false, "return shouldKeepWindowOpen('imagewindow')");
    await runAssert("shouldKeepWindowOpen('picture') option off", false, "return shouldKeepWindowOpen('picture')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('imagewindow') option on", true, "return shouldKeepWindowOpen('imagewindow')");
    await runAssert("shouldKeepWindowOpen('picture') option on", true, "return shouldKeepWindowOpen('picture')");

    // Option checks: keepRefOpen (Reference Manuals / Books)
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_REF_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('reference_manual') option off", false, "return shouldKeepWindowOpen('reference_manual')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_REF_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('reference_manual') option on", true, "return shouldKeepWindowOpen('reference_manual')");
    await runAssert("shouldKeepWindowOpen('referencemanualpage') popup closes even when Keep Books Open is on", false, "return shouldKeepWindowOpen('referencemanualpage')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_REF_OPEN', 'off')");

    // Option checks: keepSoundOpen (Sound: Context)
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_SOUND_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('sound_context') option off", false, "return shouldKeepWindowOpen('sound_context')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_SOUND_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('sound_context') option on", true, "return shouldKeepWindowOpen('sound_context')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_SOUND_OPEN', 'off')");

    // Option checks: keepTimerOpen
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_TIMER_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('timerwindow') option off", false, "return shouldKeepWindowOpen('timerwindow')");
    lua.doStringSync("OptionsManager.setOption('CLOSEWINDOWS_KEEP_TIMER_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('timerwindow') option on", true, "return shouldKeepWindowOpen('timerwindow')");

    // Safety checks: shouldCloseWindow
    lua.doStringSync(`
        wPanel = createMockWindow("chat", true)
        wNoClose = createMockWindow("desktop_setdc", false, false, { [1] = {} })
        w2EMenuDrop = createMockWindow("menus_dropwindow", false)
        wCloseTrigger = createMockWindow("closewindows", false)
        wManualRoll = createMockWindow("manualrolls", false)
        wOkCancel = createMockWindow("dialog_okcancel", false)
        wStory = createMockWindow("story", false)
        wChar = createMockWindow("charsheet", false)
    `);

    await runAssert("Panel is protected from close", false, "return shouldCloseWindow(wPanel)");
    await runAssert("<noclose /> window is protected from close", false, "return shouldCloseWindow(wNoClose)");
    await runAssert("2E menus_dropwindow is protected from close", false, "return shouldCloseWindow(w2EMenuDrop)");
    await runAssert("closewindows trigger is protected", false, "return shouldCloseWindow(wCloseTrigger)");
    await runAssert("manualrolls is protected", false, "return shouldCloseWindow(wManualRoll)");
    await runAssert("dialog_okcancel (e.g., 5E Migrate Spells) should close", true, "return shouldCloseWindow(wOkCancel)");
    await runAssert("story window should close", true, "return shouldCloseWindow(wStory)");
    await runAssert("charsheet window should close (when Keep Char Sheets Open is off)", true, "return shouldCloseWindow(wChar)");

    // Full FGU closeWindows() run including cascade-deleted / dead window resilience
    lua.doStringSync(`
        wCT = createMockWindow("combattracker_host", false)
        wDeadFGU = createMockWindow("story", false, true)
        wImg = createMockWindow("imagewindow", false)
        wCharSheet = createMockWindow("charsheet", false)
        wBook = createMockWindow("reference_manual", false)
        wSound = createMockWindow("sound_context", false)
        wBackPanel = createMockWindow("imagebackpanel", true)

        activeWindows = { wCT, wDeadFGU, wImg, wCharSheet, wBook, wSound, wOkCancel, wBackPanel, wPanel, wNoClose, w2EMenuDrop }

        -- Keep CT, Books, and Sound open; close image, charsheet, and dialog_okcancel
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_REF_OPEN', 'on')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_SOUND_OPEN', 'on')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_CS_OPEN', 'off')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')

        closeWindows()
    `);

    await runAssert("FGU: wCT remains open", false, "return wCT.closed");
    await runAssert("FGU: wBook (reference_manual) remains open", false, "return wBook.closed");
    await runAssert("FGU: wSound (sound_context) remains open", false, "return wSound.closed");
    await runAssert("FGU: wImg is closed (survives prior dead window in loop)", true, "return wImg.closed");
    await runAssert("FGU: wCharSheet is closed", true, "return wCharSheet.closed");
    await runAssert("FGU: wOkCancel (Migrate Spells) is closed", true, "return wOkCancel.closed");
    await runAssert("FGU: background panel remains open", false, "return wBackPanel.closed");
    await runAssert("FGU: chat panel remains open", false, "return wPanel.closed");
    await runAssert("FGU: <noclose /> window remains open", false, "return wNoClose.closed");
    await runAssert("FGU: 2E menus_dropwindow remains open", false, "return w2EMenuDrop.closed");

    // Verify onLinkActivate triggers closeWindows() and returns true
    lua.doStringSync(`
        wCharSheet2 = createMockWindow("charsheet", false)
        activeWindows = { wCharSheet2 }
        linkHandled = onLinkActivate()
    `);
    await runAssert("FGU: onLinkActivate returns true", true, "return linkHandled");
    await runAssert("FGU: onLinkActivate closes windows", true, "return wCharSheet2.closed");

    console.log("\n=== SUITE 2: FGC Fallback Mode (Strict FGC Interface Metatable & Dead-Window Pruning) ===");

    // Switch to FGC mode: Interface.getVersion is 3.3.15 and Interface rejects invalid handlers (like onWindowClosing/onWindowClosed)
    lua.doStringSync(`
        origOpenedCalled = false
        Interface.setVersion(3, 3, 15)
        Interface.getWindows = nil
        Interface.onWindowOpened = function() origOpenedCalled = true end

        local validFgcHandlers = {
            onWindowOpened = true,
            onDesktopInit = true,
            onDesktopClose = true,
            onHotkeyActivated = true,
            onHotkeyDrop = true,
        }
        setmetatable(Interface, {
            __newindex = function(t, k, v)
                if type(k) == "string" and k:match("^on") and not validFgcHandlers[k] then
                    error("attempt to set a value for an invalid handler '" .. k .. "'")
                end
                rawset(t, k, v)
            end
        })

        openWindowList = {}
        onInit()
    `);

    await runAssert("IS_FGC is true in FGC", true, "return IS_FGC");

    // onWindowOpened tracking + deduplication + dead-window pruning + panel/noclose exclusion
    lua.doStringSync(`
        winFGC1 = createMockWindow("charsheet")
        winFGC2 = createMockWindow("imagewindow")
        winFGC3 = createMockWindow("story")
        winExcluded = createMockWindow("closewindows")
        winPanelFGC = createMockWindow("chat", true)
        winNoCloseFGC = createMockWindow("modifierstack", false, false, { [1] = {} })

        onWindowOpened(winFGC1)
        onWindowOpened(winFGC1) -- duplicate open event should not duplicate entry
        onWindowOpened(winFGC2)
        onWindowOpened(winFGC3)
        onWindowOpened(winExcluded)
        onWindowOpened(winPanelFGC)
        onWindowOpened(winNoCloseFGC)
    `);

    await runAssert("FGC: original onWindowOpened handler chained", true, "return origOpenedCalled");
    await runAssert("FGC: openWindowList has 3 tracked windows (duplicates, panels, noclose, closewindows excluded)", 3, "return #openWindowList");

    // Simulate user manually closing winFGC3 in FGC (making it a dead windowinstance), then opening a new window
    lua.doStringSync(`
        winFGC3.bDead = true
        winFGC4 = createMockWindow("encounter")
        onWindowOpened(winFGC4)
    `);
    await runAssert("FGC: onWindowOpened automatically prunes manually-closed (dead) winFGC3 while adding winFGC4", 3, "return #openWindowList");

    // FGC closeWindows with options
    lua.doStringSync(`
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'on')
        closeWindows()
    `);

    await runAssert("FGC: winFGC1 is closed", true, "return winFGC1.closed");
    await runAssert("FGC: winFGC4 is closed", true, "return winFGC4.closed");
    await runAssert("FGC: winFGC2 (kept) is NOT closed", false, "return winFGC2.closed");
    await runAssert("FGC: openWindowList retains kept winFGC2", 1, "return #openWindowList");

    // FGC Dead Userdata resilience test during closeWindows() (user manually closed a window right before clicking Close All)
    lua.doStringSync(`
        openWindowList = {}
        deadWin = createMockWindow("story", false, true) -- throws error on getClass/close
        aliveWin = createMockWindow("charsheet", false, false)

        table.insert(openWindowList, deadWin)
        table.insert(openWindowList, aliveWin)

        -- This must not throw an error and must safely discard deadWin and close aliveWin
        closeWindows()
    `);

    await runAssert("FGC: aliveWin is closed", true, "return aliveWin.closed");
    await runAssert("FGC: deadWin safely discarded without crashing", 0, "return #openWindowList");

    console.log(`\nAll Test Suites Finished: ${testsPassed} passed, ${testsFailed} failed.`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution failed: ", err);
    process.exit(1);
});
