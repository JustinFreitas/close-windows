--
-- Close Windows Extension for Fantasy Grounds (FGC/FGU)
-- Justin Freitas
--

CLOSEWINDOWS_KEEP_CS_OPEN = "CLOSEWINDOWS_KEEP_CS_OPEN";
CLOSEWINDOWS_KEEP_CT_OPEN = "CLOSEWINDOWS_KEEP_CT_OPEN";
CLOSEWINDOWS_KEEP_IMAGES_OPEN = "CLOSEWINDOWS_KEEP_IMAGES_OPEN";
CLOSEWINDOWS_KEEP_PS_OPEN = "CLOSEWINDOWS_KEEP_PS_OPEN";
CLOSEWINDOWS_KEEP_REF_OPEN = "CLOSEWINDOWS_KEEP_REF_OPEN";
CLOSEWINDOWS_KEEP_SOUND_OPEN = "CLOSEWINDOWS_KEEP_SOUND_OPEN";
CLOSEWINDOWS_KEEP_TIMER_OPEN = "CLOSEWINDOWS_KEEP_TIMER_OPEN";
OFF = "off";
ON = "on";

IS_FGC = false;
local onWindowOpened_Original;
local openWindowList = {};

local tExcludedClasses = {
	["closewindows"] = true,
	["menus_dropwindow"] = true,
	["records_dropwindow"] = true,
	["refmanuals_dropwindow"] = true,
	["manualrolls"] = true,
};

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
		-- FGC Legacy fallback: hook Interface.onWindowOpened (FGC does not support onWindowClosing/onWindowClosed handlers on Interface)
		onWindowOpened_Original = Interface.onWindowOpened;
		Interface.onWindowOpened = onWindowOpened;
		DesktopManager.registerDockShortcut2("closewindows", "closewindows", "sidebar_tooltip_closeall", "closewindows", "closewindows", true, false);
		if MenuManager ~= nil and MenuManager.addMenuItem ~= nil then
			MenuManager.addMenuItem("closewindows", "closewindows", "library_recordtype_label_closewindows", Interface.getString("library_recordtype_label_closewindows"), false);
		end
	end

	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_CS_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_CS_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_CT_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_CT_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_IMAGES_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_IMAGES_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_PS_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_PS_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_REF_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_REF_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_SOUND_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_SOUND_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });
	OptionsManager.registerOption2(CLOSEWINDOWS_KEEP_TIMER_OPEN, true, option_header, "option_label_CLOSEWINDOWS_KEEP_TIMER_OPEN", option_entry_cycler,
		{ labels = option_val_on, values = ON, baselabel = option_val_off, baseval = OFF, default = OFF });

	Comm.registerSlashHandler("cw", closeWindows);
	Comm.registerSlashHandler("closewindows", closeWindows);
end

function onTabletopInit()
	if not IS_FGC then
		if Interface.addKeyedEventHandler then
			Interface.addKeyedEventHandler("onLinkActivate", "closewindows", onLinkActivate);
		end

		local tButton = {
			sIcon = "sidebar_icon_close",
			tooltipres = "library_recordtype_label_closewindows",
			class = "closewindows",
		};
		DesktopManager.registerSidebarToolButton(tButton);

		-- Refresh AD&D 2E desktop menu dropdown if active
		if MenuManager ~= nil and MenuManager.menusWindow and MenuManager.menusWindow.createMenuSelections then
			MenuManager.menusWindow.createMenuSelections();
		end
	end
end

function onLinkActivate()
	closeWindows();
	return true;
end

function isCombatTrackerClass(sClass)
	if not sClass or type(sClass) ~= "string" then
		return false;
	end
	return sClass == "combattracker_host"
		or sClass == "combattracker_client"
		or sClass == "combattracker"
		or sClass == "ct_ship_combat"
		or sClass:match("^combattracker_") ~= nil
		or sClass:match("^shipcombattracker_") ~= nil;
end

function isPartySheetClass(sClass)
	if not sClass or type(sClass) ~= "string" then
		return false;
	end
	return sClass == "partysheet_host"
		or sClass == "partysheet_client"
		or sClass == "partysheet"
		or sClass:match("^partysheet_") ~= nil;
end

function isImageClass(sClass)
	if not sClass or type(sClass) ~= "string" then
		return false;
	end
	return sClass == "imagewindow" or sClass == "picture";
end

function isExcludedClass(sClass)
	if not sClass or type(sClass) ~= "string" or sClass == "" then
		return true;
	end
	return tExcludedClasses[sClass] == true;
end

function shouldKeepWindowOpen(sClass)
	if not sClass or type(sClass) ~= "string" or sClass == "" then
		return false;
	end

	-- Keep Character Sheets
	if sClass == "charsheet" and OptionsManager.isOption(CLOSEWINDOWS_KEEP_CS_OPEN, ON) then
		return true;
	end
	-- Keep Combat Tracker (including ruleset variants such as SFRPG/MGT2 starship CT and FrontierSpace)
	if isCombatTrackerClass(sClass) and OptionsManager.isOption(CLOSEWINDOWS_KEEP_CT_OPEN, ON) then
		return true;
	end
	-- Keep Party Sheet (including CoreRPG base 'partysheet' and ruleset variants)
	if isPartySheetClass(sClass) and OptionsManager.isOption(CLOSEWINDOWS_KEEP_PS_OPEN, ON) then
		return true;
	end
	-- Keep Images / Maps / Legacy Pictures
	if isImageClass(sClass) and OptionsManager.isOption(CLOSEWINDOWS_KEEP_IMAGES_OPEN, ON) then
		return true;
	end
	-- Keep Reference Manuals / Books
	if sClass == "reference_manual" and OptionsManager.isOption(CLOSEWINDOWS_KEEP_REF_OPEN, ON) then
		return true;
	end
	-- Keep Sound Context
	if sClass == "sound_context" and OptionsManager.isOption(CLOSEWINDOWS_KEEP_SOUND_OPEN, ON) then
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

	-- Never close desktop panels (chat, dice tower, modifier stack, sidebar, background map panels)
	if w.isPanel and w.isPanel() then
		return false;
	end

	-- Respect <noclose /> windowclass attribute (CoreRPG desktop controls, 2E menu dropdowns, PFRPG2 DC widget, SavageWorlds tools, etc.)
	if w.noclose then
		return false;
	end

	local sClass = w.getClass();
	if isExcludedClass(sClass) then
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
	if not IS_FGC and Interface.getWindows then
		-- Modern FGU path: directly query active windows with pcall protection against cascade closes or 3rd-party onClose errors
		local tWindows = Interface.getWindows();
		if tWindows then
			for _, w in ipairs(tWindows) do
				local bOk, bClose = pcall(shouldCloseWindow, w);
				if bOk and bClose then
					pcall(function() w.close(); end);
				end
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

	if window == nil or type(window) ~= "windowinstance" then return; end
	if (window.isPanel and window.isPanel()) or window.noclose then return; end

	local sWindowClass = window.getClass();
	if not isExcludedClass(sWindowClass) then
		local bAlreadyTracked = false;
		-- Prune any dead/manually-closed FGC window handles while checking for duplicates
		arrayRemove(openWindowList, function(t, i)
			local wExisting = t[i];
			local bAlive = pcall(function() return wExisting.getClass(); end);
			if not bAlive then
				return false;
			end
			if wExisting == window then
				bAlreadyTracked = true;
			end
			return true;
		end);
		if not bAlreadyTracked then
			table.insert(openWindowList, window);
		end
	end
end
