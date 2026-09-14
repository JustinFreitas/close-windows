const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { LuaFactory } = require('wasmoon');

async function runTests() {
    console.log("Setting up Lua VM via wasmoon...");
    const luaFactory = new LuaFactory();
    const lua = await luaFactory.createEngine();

    console.log("Mocking Fantasy Grounds environment globals...");
    await lua.doString(`
        Interface = {}
        OptionsManager = {}
        Comm = {}
        DesktopManager = {}
        MenuManager = {}
        DialogManager = {
            dialogs = { ["custom_dialog"] = true },
            isDialogClass = function(s)
                return DialogManager.dialogs[s] == true
            end
        }

        local major, minor, patch = 5, 1, 13
        function Interface.getVersion()
            return major, minor, patch
        end
        function Interface.setVersion(ma, mi, pa)
            major, minor, patch = ma, mi, pa
        end

        Interface.getString = function(s) return s end

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
        function Comm.registerSlashHandler() end

        local original_type = _G.type
        _G.type = function(v)
            if original_type(v) == "table" and v.sClass ~= nil then
                return "windowinstance"
            end
            return original_type(v)
        end

        function createMockWindow(sClass, bIsPanel, bDead)
            local win = {}
            win.sClass = sClass or "windowinstance"
            win.closed = false
            win.bPanel = bIsPanel or false
            win.bDead = bDead or false

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
    await lua.doString(luaCodeModified);
    console.log("CloseWindows loaded successfully inside VM.\n");

    let testsPassed = 0;
    let testsFailed = 0;

    async function runAssert(fnName, expected, luaCodeToRun) {
        try {
            const result = await lua.doString(luaCodeToRun);
            assert.strictEqual(result, expected);
            console.log(`  ✓ PASS: ${fnName} -> got ${result}`);
            testsPassed++;
        } catch (err) {
            console.error(`  ✗ FAIL: ${fnName} -> expected ${expected}, got error or mismatch: ${err.message}`);
            testsFailed++;
        }
    }

    console.log("=== SUITE 1: FGU Mode (Interface.getWindows) ===");

    // Set up FGU environment: Interface.getWindows is a function
    await lua.doString(`
        activeWindows = {}
        function Interface.getWindows()
            return activeWindows
        end

        onInit()
    `);

    // Verify IS_FGC detected as false in FGU
    await runAssert("IS_FGC is false in FGU", false, "return IS_FGC");

    // Option checks: keepCtOpen
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('combattracker_host') option off", false, "return shouldKeepWindowOpen('combattracker_host')");
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('combattracker_host') option on", true, "return shouldKeepWindowOpen('combattracker_host')");
    await runAssert("shouldKeepWindowOpen('combattracker_client') option on", true, "return shouldKeepWindowOpen('combattracker_client')");
    await runAssert("shouldKeepWindowOpen('charsheet') CT option on", false, "return shouldKeepWindowOpen('charsheet')");

    // Option checks: keepPsOpen
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_PS_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('partysheet_host') option off", false, "return shouldKeepWindowOpen('partysheet_host')");
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_PS_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('partysheet_host') option on", true, "return shouldKeepWindowOpen('partysheet_host')");
    await runAssert("shouldKeepWindowOpen('partysheet_client') option on", true, "return shouldKeepWindowOpen('partysheet_client')");

    // Option checks: keepImagesOpen
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('imagewindow') option off", false, "return shouldKeepWindowOpen('imagewindow')");
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('imagewindow') option on", true, "return shouldKeepWindowOpen('imagewindow')");

    // Option checks: keepTimerOpen
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_TIMER_OPEN', 'off')");
    await runAssert("shouldKeepWindowOpen('timerwindow') option off", false, "return shouldKeepWindowOpen('timerwindow')");
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_TIMER_OPEN', 'on')");
    await runAssert("shouldKeepWindowOpen('timerwindow') option on", true, "return shouldKeepWindowOpen('timerwindow')");

    // Safety checks: shouldCloseWindow
    await lua.doString(`
        wPanel = createMockWindow("chat", true)
        wCloseTrigger = createMockWindow("closewindows", false)
        wManualRoll = createMockWindow("manualrolls", false)
        wColorPicker = createMockWindow("colorpicker", false)
        wOkCancel = createMockWindow("dialog_okcancel", false)
        wPrompt = createMockWindow("prompt", false)
        wCustomDialog = createMockWindow("custom_dialog", false)
        wStory = createMockWindow("story", false)
        wChar = createMockWindow("charsheet", false)
    `);

    await runAssert("Panel is protected from close", false, "return shouldCloseWindow(wPanel)");
    await runAssert("closewindows trigger is protected", false, "return shouldCloseWindow(wCloseTrigger)");
    await runAssert("manualrolls is protected", false, "return shouldCloseWindow(wManualRoll)");
    await runAssert("colorpicker is protected", false, "return shouldCloseWindow(wColorPicker)");
    await runAssert("dialog_okcancel is protected", false, "return shouldCloseWindow(wOkCancel)");
    await runAssert("prompt is protected", false, "return shouldCloseWindow(wPrompt)");
    await runAssert("DialogManager custom dialog is protected", false, "return shouldCloseWindow(wCustomDialog)");
    await runAssert("story window should close", true, "return shouldCloseWindow(wStory)");
    await runAssert("charsheet window should close", true, "return shouldCloseWindow(wChar)");

    // Full FGU closeWindows() run
    await lua.doString(`
        wCT = createMockWindow("combattracker_host", false)
        wImg = createMockWindow("imagewindow", false)
        wCharSheet = createMockWindow("charsheet", false)
        wBackPanel = createMockWindow("imagebackpanel", true)

        activeWindows = { wCT, wImg, wCharSheet, wBackPanel, wPanel }

        -- Keep CT open, close image and charsheet
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')

        closeWindows()
    `);

    await runAssert("FGU: wCT remains open", false, "return wCT.closed");
    await runAssert("FGU: wImg is closed", true, "return wImg.closed");
    await runAssert("FGU: wCharSheet is closed", true, "return wCharSheet.closed");
    await runAssert("FGU: background panel remains open", false, "return wBackPanel.closed");
    await runAssert("FGU: chat panel remains open", false, "return wPanel.closed");

    console.log("\n=== SUITE 2: FGC Fallback Mode (openWindowList with pcall) ===");

    // Switch to FGC mode: Interface.getVersion is 3.3.15
    await lua.doString(`
        Interface.setVersion(3, 3, 15)
        Interface.getWindows = nil
        openWindowList = {}
        onInit()
    `);

    await runAssert("IS_FGC is true in FGC", true, "return IS_FGC");

    // onWindowOpened tracking
    await lua.doString(`
        winFGC1 = createMockWindow("charsheet")
        winFGC2 = createMockWindow("imagewindow")
        winExcluded = createMockWindow("closewindows")

        onWindowOpened(winFGC1)
        onWindowOpened(winFGC2)
        onWindowOpened(winExcluded)
    `);

    await runAssert("FGC: openWindowList has 2 tracked windows (closewindows excluded)", 2, "return #openWindowList");

    // FGC closeWindows with options
    await lua.doString(`
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'on')
        closeWindows()
    `);

    await runAssert("FGC: winFGC1 is closed", true, "return winFGC1.closed");
    await runAssert("FGC: winFGC2 (kept) is NOT closed", false, "return winFGC2.closed");
    await runAssert("FGC: openWindowList retains kept winFGC2", 1, "return #openWindowList");

    // FGC Dead Userdata resilience test (user manually closed a window in FGC)
    await lua.doString(`
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
