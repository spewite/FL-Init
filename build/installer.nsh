RequestExecutionLevel user

!macro customInstall
  SetOutPath "$INSTDIR"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\resources\app.asar.unpacked\icons\icon.ico" 0
  ; Call venv copy as part of the installation process
  Call CopyVenvToUserData
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend

; Function to copy the venv folder silently during installation
Function CopyVenvToUserData
  ; Destination folder: %APPDATA%\flinit\venv
  StrCpy $0 "$APPDATA\flinit\venv"
  DetailPrint "Copying venv to $0"  ; logging instead of messagebox
  CreateDirectory "$0"
  ; Use the correct source path from the resources folder
  StrCpy $2 "$INSTDIR\resources\venv\*"
  DetailPrint "Copying from $2"  ; logging instead of messagebox
  nsExec::ExecToLog 'xcopy "$2" "$0\" /E /I /Y'
  Pop $1  ; exit code from xcopy
  DetailPrint "xcopy exit code: $1"
  StrCmp $1 "0" 0 +3
    DetailPrint "Venv copied successfully."
    goto endCopy
  DetailPrint "Error copying venv folder."
  goto endCopy
  endCopy:
FunctionEnd
