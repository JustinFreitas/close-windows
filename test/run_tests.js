const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { LuaFactory } = require('wasmoon');

async function runTests() {
    console.log("Setting up Lua VM via wasmoon...");
    const luaFactory = new LuaFactory();
    const lua = await luaFactory.createEngine();

    // 1. Mock FGU environment globals
    console.log("Mocking FGU environment globals...");
    
    await lua.doString(`
        Interface = {}
        OptionsManager = {}
        Comm = {}
        DesktopManager = {}
        MenuManager = {}
        
        -- Default FGU Version to FGU (4.x)
        local major, minor, patch = 4, 1, 0
        function Interface.getVersion()
            return major, minor, patch
        end
        function Interface.setVersion(ma, mi, pa)
            major, mi, patch = ma, mi, pa
        end

        Interface.getString = function(s) return s end
        Interface.addKeyedEventHandler = function() end

        -- Mock OptionsManager
        local options = {}
        function OptionsManager.registerOption2() end
        function OptionsManager.isOption(key, val)
            return options[key] == val
        end
        function OptionsManager.setOption(key, val)
            options[key] = val
        end

        -- Mock DesktopManager & Comm
        function DesktopManager.registerSidebarToolButton() end
        function DesktopManager.registerDockShortcut2() end
        function Comm.registerSlashHandler() end

        -- Override global type function to return "windowinstance" for our mock window tables
        local original_type = _G.type
        _G.type = function(v)
            if original_type(v) == "table" and v.sClass ~= nil then
                return "windowinstance"
            end
            return original_type(v)
        end

        -- Helper to create a mock windowinstance userdata/table
        function createMockWindow(sClass)
            local win = {}
            win.sClass = sClass or "windowinstance"
            win.closed = false
            
            function win.getClass()
                return win.sClass
            end
            
            function win.close()
                win.closed = true
            end
            
            return win
        end
    `);

    // 2. Load the actual closewindows script
    console.log("Loading scripts/closewindows.lua into VM...");
    const luaCodePath = path.join(__dirname, '../scripts/closewindows.lua');
    const luaCode = fs.readFileSync(luaCodePath, 'utf8');
    
    // Replace local openWindowList with global for testing inspection
    const luaCodeModified = luaCode.replace('local openWindowList = {};', 'openWindowList = {};');
    
    await lua.doString(luaCodeModified);
    console.log("CloseWindows loaded successfully inside VM.\n");

    // 3. Define and run test assertions
    console.log("Running Unit Tests...");
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



    // --- TEST 3: keepCtOpen options checks ---
    await lua.doString(`
        winCT = createMockWindow("combattracker_host")
        winImg = createMockWindow("imagewindow")
    `);
    
    // CT Open Option: OFF
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'off')");
    await runAssert("keepCtOpen(winCT) option off", false, "return keepCtOpen({winCT}, 1)");
    
    // CT Open Option: ON
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')");
    await runAssert("keepCtOpen(winCT) option on", true, "return keepCtOpen({winCT}, 1)");
    await runAssert("keepCtOpen(winImg) option on but other class", false, "return keepCtOpen({winImg}, 1)");

    // --- TEST 4: keepImagesOpen option checks ---
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')");
    await runAssert("keepImagesOpen(winImg) option off", false, "return keepImagesOpen({winImg}, 1)");
    await lua.doString("OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'on')");
    await runAssert("keepImagesOpen(winImg) option on", true, "return keepImagesOpen({winImg}, 1)");

    // --- TEST 5: onWindowOpened inserts window into openWindowList ---
    await lua.doString(`
        -- Clear existing list
        openWindowList = {}
        win1 = createMockWindow("imagewindow")
        win2 = createMockWindow("charsheet")
        
        onWindowOpened(win1)
        onWindowOpened(win2)
    `);
    
    await runAssert("openWindowList length", 2, "return #openWindowList");

    // --- TEST 6: onWindowClosed removes window from openWindowList ---
    await lua.doString(`
        onWindowClosed(win1)
    `);
    await runAssert("openWindowList length after close", 1, "return #openWindowList");
    await runAssert("remaining window is win2", "charsheet", "return openWindowList[1].getClass()");

    // --- TEST 7: closeWindows() with options ---
    await lua.doString(`
        openWindowList = {}
        winCT = createMockWindow("combattracker_host")
        winImg = createMockWindow("imagewindow")
        winChar = createMockWindow("charsheet")
        
        onWindowOpened(winCT)
        onWindowOpened(winImg)
        onWindowOpened(winChar)
        
        -- Keep CT open, but close images and charsheets
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_CT_OPEN', 'on')
        OptionsManager.setOption('CLOSEWINDOWS_KEEP_IMAGES_OPEN', 'off')
        
        closeWindows()
    `);
    
    await runAssert("winCT is NOT closed", false, "return winCT.closed");
    await runAssert("winImg IS closed", true, "return winImg.closed");
    await runAssert("winChar IS closed", true, "return winChar.closed");
    await runAssert("openWindowList retains winCT", 1, "return #openWindowList");

    // 4. Print Summary
    console.log(`\nTest Summary: ${testsPassed} passed, ${testsFailed} failed.`);
    
    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution failed: ", err);
    process.exit(1);
});
