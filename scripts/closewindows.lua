CLOSEWINDOWS_KEEP_CT_OPEN = "CLOSEWINDOWS_KEEP_CT_OPEN";
CLOSEWINDOWS_KEEP_IMAGES_OPEN = "CLOSEWINDOWS_KEEP_IMAGES_OPEN";
CLOSEWINDOWS_KEEP_PS_OPEN = "CLOSEWINDOWS_KEEP_PS_OPEN";
CLOSEWINDOWS_KEEP_TIMER_OPEN = "CLOSEWINDOWS_KEEP_TIMER_OPEN";
IS_FGC = false;
OFF = "off";
ON = "on";
local onWindowOpened_Original;
local onWindowClosed_Original;
local openWindowList = {};

function onInit()
	local option_header = "option_header_closewindows";
	-- option_val_off, option_val_on, and option_entry_cycler are CoreRPG built-in strings (reused, not defined by this extension).
	local option_val_off = "option_val_off";
	local option_val_on = "option_val_on";
	local option_entry_cycler = "option_entry_cycler";

    Interface.addKeyedEventHandler("onWindowOpened", "", onWindowOpened);
    Interface.addKeyedEventHandler("onWindowClosed", "", onWindowClosed);

    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_CT_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_CT_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_IMAGES_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_IMAGES_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_PS_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_PS_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_TIMER_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_TIMER_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    Comm.registerSlashHandler("cw", closeWindows);
    Comm.registerSlashHandler("closewindows", closeWindows);
end

function onTabletopInit()
    local tButton = {
        sIcon = "sidebar_icon_close",
        tooltipres = "library_recordtype_label_closewindows",
        class = "closewindows",
    };

    DesktopManager.registerSidebarToolButton(tButton);
    if MenuManager ~= nil and MenuManager.menusWindow then
        MenuManager.menusWindow.createMenuSelections();
    end
end

-- https://stackoverflow.com/questions/12394841/safely-remove-items-from-an-array-table-while-iterating
function arrayRemove(t, fnKeep)
    local j, n = 1, #t;

    for i=1,n do
        if (fnKeep(t, i)) then
            -- Move i's kept value to j's position, if it's not already there.
            if (i ~= j) then
                t[j] = t[i];
                t[i] = nil;
            end
            j = j + 1; -- Increment position of where we'll place the next kept value.
        else
            t[i] = nil;
        end
    end

    return t;
end



function closeWindow(t, i)
    if t ~= nil
        and t[i] ~= nil
        and type(t[i]) == "windowinstance"
        and t[i].close ~= nil then
        if keepCtOpen(t, i)
            or keepImagesOpen(t, i)
            or keepPsOpen(t, i)
            or keepTimerOpen(t, i) then
                return true;
        end

        t[i].close();
    end

    return false;
end

function closeWindows()
    arrayRemove(openWindowList, closeWindow);
end

function keepCtOpen(t, i)
    local keepCtOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_CT_OPEN, ON);
    return keepCtOpen and (t[i].getClass() == "combattracker_host" or t[i].getClass() == "combattracker_client");
end

function keepImagesOpen(t, i)
    local keepImagesOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_IMAGES_OPEN, ON);
    return keepImagesOpen and t[i].getClass() == "imagewindow";
end

function keepPsOpen(t, i)
    local keepPsOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_PS_OPEN, ON);
    return keepPsOpen and (t[i].getClass() == "partysheet_host" or t[i].getClass() == "partysheet_client");
end

function keepTimerOpen(t, i)
    local keepTimerOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_TIMER_OPEN, ON);
    return keepTimerOpen and t[i].getClass() == "timerwindow";
end

function onWindowOpened(window)
    if window == nil then return end

    local sWindowClass = window.getClass();
    if type(window) == "windowinstance"
        and sWindowClass ~= "menus_dropwindow"
        and sWindowClass ~= "records_dropwindow"
        and sWindowClass ~= "refmanuals_dropwindow"
        and sWindowClass ~= "manualrolls" then
        table.insert(openWindowList, window);
    end
end

function onWindowClosed(window)
    if window == nil then return end

    -- Remove the closed window from the tracking list so it doesn't grow
    -- unbounded and so we never call close() on a stale/dead handle.
    arrayRemove(openWindowList, function(t, i) return t[i] ~= window; end);
end
