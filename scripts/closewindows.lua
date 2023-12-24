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
        DesktopManager.registerDockShortcut2("button_cw", "button_cw_down", "sidebar_tooltip_closewindows", "closewindows", "closewindows", true, false);
        --DesktopManager.registerStackShortcut2("button_cw", "button_cw_down", "option_header_closewindows", "closewindows", "closewindows", false);
    else
        Interface.addKeyedEventHandler("onWindowOpened", "", onWindowOpened);
        -- local tButton = {
        --     sIcon = "sidebar_icon_close",
        --     tooltipres = "option_header_closewindows",
        --     class = "closewindows",
        -- }

        -- DesktopManager.registerSidebarToolButton(tButton)
    end

    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_CT_OPEN, false, option_header, "option_label_CLOSEWINDOWS_KEEP_CT_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_IMAGES_OPEN, false, option_header, "option_label_CLOSEWINDOWS_KEEP_IMAGES_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_PS_OPEN, false, option_header, "option_label_CLOSEWINDOWS_KEEP_PS_OPEN", option_entry_cycler,
    { labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
    Comm.registerSlashHandler("cw", closeWindows);
end

function onTabletopInit()
	IS_FGC = checkFGC();
    if not IS_FGC then
        local tButton = {
            sIcon = "sidebar_icon_close",
            tooltipres = "option_header_closewindows",
            class = "closewindows",
        }

        DesktopManager.registerSidebarToolButton(tButton)
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
	return nMajor == 3 and nMinor == 3 and nPatch <= 15
end

function closeWindow(t, i)
    local keepCtOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_CT_OPEN, ON);
    local keepImagesOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_IMAGES_OPEN, ON);
    local keepPsOpen = OptionsManager.isOption(CLOSEWINDOWS_KEEP_PS_OPEN, ON);
    if t ~= nil
        and t[i] ~= nil
        and type(t[i]) == "windowinstance"
        and t[i].close ~= nil then
        if (keepCtOpen and (t[i].getClass() == "combattracker_host" or t[i].getClass() == "combattracker_client"))
            or (keepImagesOpen and t[i].getClass() == "imagewindow")
            or (keepPsOpen and (t[i].getClass() == "partysheet_host" or t[i].getClass() == "partysheet_client")) then
            return true;
        end

        t[i].close();
    end

    return false;
end

function closeWindows()
    arrayRemove(openWindowList, closeWindow);
end

function onWindowOpened(window)
    if IS_FGC and onWindowOpened_Original ~= nil then
        onWindowOpened_Original(window);
    end

    if window ~= nil
        and type(window) == "windowinstance"
        and window.getClass() ~= "menus_dropwindow"
        and window.getClass() ~= "records_dropwindow"
        and window.getClass() ~= "refmanuals_dropwindow"
        and window.getClass() ~= "manualrolls" then
        table.insert(openWindowList, window);
    end
end
