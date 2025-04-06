!macro customInstall
  SetOutPath "$INSTDIR"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\resources\app.asar.unpacked\icons\icon.ico" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend