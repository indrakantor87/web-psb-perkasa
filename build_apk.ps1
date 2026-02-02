$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
Write-Host "Setting JAVA_HOME to $env:JAVA_HOME"
Set-Location android
Write-Host "Cleaning previous builds..."
.\gradlew.bat clean
Write-Host "Building APK..."
.\gradlew.bat assembleDebug --warning-mode all
Write-Host "Build process completed. Check android\app\build\outputs\apk\debug for the APK."
Read-Host -Prompt "Press Enter to exit"
