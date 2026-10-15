; Keep the standard install/uninstall and PDF registration, but do not start
; PowerShell/cmd/taskkill or terminate a running editor (unsaved work).
; nsProcess only queries the executable name. 603 means no matching process.
; A copy running from another directory also blocks conservatively.
!macro customCheckAppRunning
  pdf_editor_check_running:
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${If} $R0 == 603
      Goto pdf_editor_check_done
    ${EndIf}
    ${If} ${Silent}
      SetErrorLevel 2
      Quit
    ${EndIf}
    ${If} $R0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Please save your work and close all PDF Editor windows, then click Retry." /SD IDCANCEL IDRETRY pdf_editor_check_running
    ${Else}
      MessageBox MB_OK|MB_ICONSTOP "Unable to check whether PDF Editor is running. Installation or removal has been stopped safely." /SD IDOK
    ${EndIf}
    SetErrorLevel 2
    Quit
  pdf_editor_check_done:
!macroend
