:: Works on Windows (10 and 11, at least). Assumes running from CloseWindows\build
mkdir out\CloseWindows
copy ..\extension.xml out\CloseWindows\
xcopy ..\campaign\*.* out\CloseWindows\campaign /h /i /c /k /e /r /y
xcopy ..\graphics\*.* out\CloseWindows\graphics /h /i /c /k /e /r /y
xcopy ..\scripts\closewindows.lua out\CloseWindows\scripts\
cd out
CALL ..\zip-items CloseWindows
rmdir /S /Q CloseWindows\
copy CloseWindows.zip CloseWindows.ext
cd ..
explorer .\out
