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
  MessageBox MB_OK "Debug: Destination folder is $0"
  CreateDirectory "$0"
  ; Define source folder variable for debugging
  StrCpy $2 "$INSTDIR\venv\*"
  MessageBox MB_OK "Debug: Source folder is $2"
  nsExec::ExecToLog 'xcopy "$INSTDIR\venv\*" "$0\" /E /I /Y'
  Pop $1  ; Exit code from xcopy
  DetailPrint "xcopy exit code: $1"
  StrCmp $1 "0" 0 +3
    DetailPrint "Venv copied successfully."
    goto endCopy
  MessageBox MB_OK "Error copying venv folder."
  goto endCopy
  endCopy:
FunctionEnd

Function .onInstSuccess
  Call CopyVenvToUserData
FunctionEnd
