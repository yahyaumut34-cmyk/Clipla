# Clipla Flutter — Native Kurulum Scripti
# PowerShell'de çalıştırın: .\setup_native.ps1
# Gereksinim: Flutter SDK PATH'te olmalı

Write-Host "Clipla Flutter Native Kurulumu Başlıyor..." -ForegroundColor Cyan

$flutterDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $flutterDir

# 1. Flutter native klasörleri oluştur
Write-Host "`n[1/4] Flutter native scaffold..." -ForegroundColor Yellow
flutter create . --org com.cliplav --project-name clipla --platforms android,ios

# 2. AndroidManifest.xml izinlerini ekle
Write-Host "`n[2/4] Android izinleri ekleniyor..." -ForegroundColor Yellow
$manifestPath = "android\app\src\main\AndroidManifest.xml"
if (Test-Path $manifestPath) {
    $content = Get-Content $manifestPath -Raw
    $permissions = @"
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28"/>
"@
    # <manifest> tagından sonra ekle
    $content = $content -replace '(<manifest[^>]*>)', "`$1`n$permissions"
    Set-Content $manifestPath $content
    Write-Host "  ✓ AndroidManifest.xml guncellendi" -ForegroundColor Green
} else {
    Write-Host "  ! AndroidManifest.xml bulunamadi, manuel ekleyin." -ForegroundColor Red
}

# 3. Info.plist izinlerini ekle
Write-Host "`n[3/4] iOS izinleri ekleniyor..." -ForegroundColor Yellow
$infoPlistPath = "ios\Runner\Info.plist"
if (Test-Path $infoPlistPath) {
    $content = Get-Content $infoPlistPath -Raw
    $iosPermissions = @"
	<key>NSMicrophoneUsageDescription</key>
	<string>Clipla ses komutları için mikrofon kullanır</string>
	<key>NSSpeechRecognitionUsageDescription</key>
	<string>Clipla sesli komutları metne çevirmek için konuşma tanıma kullanır</string>
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Clipla video seçmek için medya kütüphanesine erişir</string>
	<key>NSPhotoLibraryAddUsageDescription</key>
	<string>Clipla düzenlenen videoyu kaydetmek için kütüphane erişimi ister</string>
"@
    # <dict> tagından sonra ekle
    $content = $content -replace '(<dict>)', "`$1`n$iosPermissions"
    Set-Content $infoPlistPath $content
    Write-Host "  ✓ Info.plist guncellendi" -ForegroundColor Green
} else {
    Write-Host "  ! Info.plist bulunamadi, manuel ekleyin." -ForegroundColor Red
}

# 4. Android minimum SDK'yı güncelle (record paketi min 24 gerektirir)
Write-Host "`n[4/4] build.gradle minSdk guncelleniyor..." -ForegroundColor Yellow
$buildGradlePath = "android\app\build.gradle"
if (Test-Path $buildGradlePath) {
    $content = Get-Content $buildGradlePath -Raw
    $content = $content -replace 'minSdkVersion\s+\d+', 'minSdkVersion 24'
    $content = $content -replace 'compileSdkVersion\s+\d+', 'compileSdkVersion 35'
    $content = $content -replace 'targetSdkVersion\s+\d+', 'targetSdkVersion 35'
    Set-Content $buildGradlePath $content
    Write-Host "  ✓ build.gradle guncellendi (minSdk=24, compile/targetSdk=35)" -ForegroundColor Green
} else {
    Write-Host "  ! build.gradle bulunamadi, flutter create sonrası kontrol edin." -ForegroundColor Red
}

Write-Host "`n✅ Kurulum tamamlandi!" -ForegroundColor Green
Write-Host ""
Write-Host "Sonraki adimlar:" -ForegroundColor Cyan
Write-Host "  Android: flutter build appbundle --release"
Write-Host "  iOS:     flutter build ios --release  (Mac gerekli)"
Write-Host ""
Write-Host "Keystore olusturmak icin RELEASE_SETUP.md dosyasini okuyun."
