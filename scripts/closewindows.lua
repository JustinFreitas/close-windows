CLOSEWINDOWS_KEEP_CT_OPEN = "CLOSEWINDOWS_KEEP_CT_OPEN";
CLOSEWINDOWS_KEEP_IMAGES_OPEN = "CLOSEWINDOWS_KEEP_IMAGES_OPEN";
CLOSEWINDOWS_KEEP_PS_OPEN = "CLOSEWINDOWS_KEEP_PS_OPEN";
IS_FGC = false;
OFF = "off";
ON = "on";
local onWindowOpened_Original;
local openWindowList = {};

function onInit()
	local option_header = "option_header_closewindows";
	local option_val_off = "option_val_off";
	local option_val_on = "option_val_on";
	local option_entry_cycler = "option_entry_cycler";

	IS_FGC = checkFGC();
    if IS_FGC then
        onWindowOpened_Original = Interface.onWindowOpened;
        Interface.onWindowOpened = onWindowOpened;
        -- I couldn't get FGC sidebar icon to look 100% matching, so let's use the text button at the bottom instead.
        DesktopManager.registerDockShortcut2("closewindows", "closewindows", "sidebar_tooltip_closeall", "closewindows", "closewindows", true, false);
        if MenuManager ~= nil and MenuManager.addMenuItem ~= nil then
            MenuManager.addMenuItem("closewindows", "closewindows", "library_recordtype_label_closewindows", Interface.getString("library_recordtype_label_closewindows"), false);
        end
    else
        Interface.addKeyedEventHandler("onWindowOpened", "", onWindowOpened);
    end

    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_CT_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_CT_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_IMAGES_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_IMAGES_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_PS_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_PS_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    Comm.registerSlashHandler("cw", closeWindows);
    Comm.registerSlashHandler("closewindows", closeWindows);
end

function onTabletopInit()
    if not IS_FGC then
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

function checkFGC()
	local nMajor, nMinor, nPatch = Interface.getVersion()
	if nMajor <= 2 then return true end
	if nMajor == 3 and nMinor <= 2 then return true end
	return nMajor == 3 and nMinor == 3 and nPatch <= 15;
end

function closeWindow(t, i)
    if t ~= nil
        and t[i] ~= nil
        and type(t[i]) == "windowinstance"
        and t[i].close ~= nil then
        if keepCtOpen(t, i)
            or keepImagesOpen(t, i)
            or keepPsOpen(t, i) then
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

function onWindowOpened(window)
    if window == nil then return end

    if IS_FGC and onWindowOpened_Original ~= nil then
        onWindowOpened_Original(window);
    end

    local sWindowClass = window.getClass();
    if type(window) == "windowinstance"
        and sWindowClass ~= "menus_dropwindow"
        and sWindowClass ~= "records_dropwindow"
        and sWindowClass ~= "refmanuals_dropwindow"
        and sWindowClass ~= "manualrolls" then
        table.insert(openWindowList, window);
    end
end
