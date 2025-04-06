!macro customInstall
  SetOutPath "$INSTDIR"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\resources\app.asar.unpacked\icons\icon.ico" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend

; Function to copy the venv folder after installation with error checking
Function CopyVenvToUserData
  ; Destination folder: %APPDATA%\flinit\venv
  StrCpy $0 "$APPDATA\flinit\venv"
  CreateDirectory "$0"
  nsExec::ExecToLog 'xcopy "$INSTDIR\venv\*" "$0\" /E /I /Y'
  Pop $1
  DetailPrint "xcopy exit code: $1"
  StrCmp $1 "0" 0 +2
    DetailPrint "Venv copied successfully."
FunctionEnd

Function .onInstSuccess
  Call CopyVenvToUserData
FunctionEnd
