--
-- Close Windows Extension for Fantasy Grounds (FGC/FGU)
-- Justin Freitas
--

CLOSEWINDOWS_KEEP_CT_OPEN = "CLOSEWINDOWS_KEEP_CT_OPEN";
CLOSEWINDOWS_KEEP_IMAGES_OPEN = "CLOSEWINDOWS_KEEP_IMAGES_OPEN";
CLOSEWINDOWS_KEEP_PS_OPEN = "CLOSEWINDOWS_KEEP_PS_OPEN";
CLOSEWINDOWS_KEEP_TIMER_OPEN = "CLOSEWINDOWS_KEEP_TIMER_OPEN";
OFF = "off";
ON = "on";

IS_FGC = false;
local onWindowOpened_Original;
local openWindowList = {};

function checkFGC()
	local nMajor, nMinor, nPatch = Interface.getVersion();
	if not nMajor then return false; end
	if nMajor <= 2 then return true; end
	if nMajor == 3 and nMinor <= 2 then return true; end
	return nMajor == 3 and nMinor == 3 and nPatch <= 15;
end

function onInit()
	local option_header = "option_header_closewindows";
	-- option_val_off, option_val_on, and option_entry_cycler are CoreRPG built-in strings (reused, not defined by this extension).
	local option_val_off = "option_val_off";
	local option_val_on = "option_val_on";
	local option_entry_cycler = "option_entry_cycler";

	IS_FGC = checkFGC();

	if IS_FGC then
		-- FGC Legacy fallback: hook Interface.onWindowOpened and register dock shortcut
		onWindowOpened_Original = Interface.onWindowOpened;
		Interface.onWindowOpened = onWindowOpened;
		DesktopManager.registerDockShortcut2("closewindows", "closewindows", "sidebar_tooltip_closeall", "closewindows", "closewindows", true, false);
		if MenuManager ~= nil and MenuManager.addMenuItem ~= nil then
			MenuManager.addMenuItem("closewindows", "closewindows", "library_recordtype_label_closewindows", Interface.getString("library_recordtype_label_closewindows"), false);
		end
	end

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
	if not IS_FGC then
		local tButton = {
			sIcon = "sidebar_icon_close",
			tooltipres = "library_recordtype_label_closewindows",
			class = "closewindows",
		};
		DesktopManager.registerSidebarToolButton(tButton);
	end
end

function shouldKeepWindowOpen(sClass)
	-- Keep Combat Tracker
	if (sClass == "combattracker_host" or sClass == "combattracker_client") and OptionsManager.isOption(CLOSEWINDOWS_KEEP_CT_OPEN, ON) then
		return true;
	end
	-- Keep Party Sheet
	if (sClass == "partysheet_host" or sClass == "partysheet_client") and OptionsManager.isOption(CLOSEWINDOWS_KEEP_PS_OPEN, ON) then
		return true;
	end
	-- Keep Images / Maps
	if sClass == "imagewindow" and OptionsManager.isOption(CLOSEWINDOWS_KEEP_IMAGES_OPEN, ON) then
		return true;
	end
	-- Keep Timer
	if sClass == "timerwindow" and OptionsManager.isOption(CLOSEWINDOWS_KEEP_TIMER_OPEN, ON) then
		return true;
	end

	return false;
end

function shouldCloseWindow(w)
	if not w or type(w) ~= "windowinstance" or not w.close then
		return false;
	end

	-- In FGU, never close desktop panels (chat, dice tower, modifier stack, sidebar, background map panel)
	if w.isPanel and w.isPanel() then
		return false;
	end

	local sClass = w.getClass();
	if not sClass or sClass == "" then
		return false;
	end

	-- Exclude dummy trigger window
	if sClass == "closewindows" then
		return false;
	end

	-- Exclude manual rolls and temporary/modal dialog popups
	if sClass == "manualrolls" or sClass == "colorpicker" or sClass == "dialog_okcancel" or sClass == "prompt" then
		return false;
	end
	if DialogManager and DialogManager.isDialogClass and DialogManager.isDialogClass(sClass) then
		return false;
	end

	-- Check user-configured keep options
	if shouldKeepWindowOpen(sClass) then
		return false;
	end

	return true;
end

-- Safely removes items from array while iterating (StackOverflow #12394841)
function arrayRemove(t, fnKeep)
	local j, n = 1, #t;
	for i = 1, n do
		if fnKeep(t, i) then
			if i ~= j then
				t[j] = t[i];
				t[i] = nil;
			end
			j = j + 1;
		else
			t[i] = nil;
		end
	end
	return t;
end

function closeWindows()
	if not IS_FGC then
		-- Modern FGU path: directly query active windows
		for _, w in ipairs(Interface.getWindows()) do
			if shouldCloseWindow(w) then
				w.close();
			end
		end
	else
		-- Legacy FGC fallback: iterate tracked windows with pcall protection against dead userdata
		arrayRemove(openWindowList, function(t, i)
			local w = t[i];
			local bOk, bClose = pcall(shouldCloseWindow, w);
			if not bOk then
				-- Window was already destroyed by user in FGC; remove dead reference
				return false;
			end
			if bClose then
				pcall(function() w.close(); end);
				return false;
			end
			return true;
		end);
	end
end

function onWindowOpened(window)
	if onWindowOpened_Original ~= nil then
		onWindowOpened_Original(window);
	end

	if window == nil or type(window) ~= "windowinstance" then return end

	local sWindowClass = window.getClass();
	if sWindowClass ~= "closewindows"
		and sWindowClass ~= "menus_dropwindow"
		and sWindowClass ~= "records_dropwindow"
		and sWindowClass ~= "refmanuals_dropwindow"
		and sWindowClass ~= "manualrolls"
		and sWindowClass ~= "colorpicker" then
		table.insert(openWindowList, window);
	end
end
