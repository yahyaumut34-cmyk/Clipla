# GitHub Secrets Kurulum Scripti
# Gereksinim: GitHub CLI (gh) kurulu ve giriş yapılmış olmalı
# Kurulum: winget install GitHub.cli
# Giriş: gh auth login

param(
    [string]$Repo = "",          # örn: "kullanici/clipla-app"
    [string]$BackendUrl = "",    # örn: "https://clipla.up.railway.app"
    [string]$ApiKey = "",        # backend API_SECRET_KEY değeri
    [string]$ExpoToken = "",     # expo.dev → Access Tokens
    [string]$SupabaseUrl = "",
    [string]$SupabaseAnonKey = ""
)

if ($Repo -eq "") {
    Write-Host "Kullanim: .\setup_github_secrets.ps1 -Repo 'kullanici/clipla-app' ..." -ForegroundColor Yellow
    exit 1
}

function SetSecret($name, $value) {
    if ($value -eq "") {
        Write-Host "  ⚠ $name atlandı (boş)" -ForegroundColor Yellow
        return
    }
    $value | gh secret set $name --repo $Repo
    Write-Host "  ✓ $name ayarlandı" -ForegroundColor Green
}

Write-Host "`nGitHub Secrets ayarlanıyor → $Repo`n" -ForegroundColor Cyan

# Expo / EAS
SetSecret "EXPO_TOKEN"                   $ExpoToken
SetSecret "EXPO_PUBLIC_BACKEND_URL"      $BackendUrl
SetSecret "EXPO_PUBLIC_API_KEY"          $ApiKey
SetSecret "EXPO_PUBLIC_SUPABASE_URL"     $SupabaseUrl
SetSecret "EXPO_PUBLIC_SUPABASE_ANON_KEY" $SupabaseAnonKey

# Flutter
SetSecret "FLUTTER_BACKEND_URL"         $BackendUrl
SetSecret "FLUTTER_API_KEY"             $ApiKey

Write-Host "`n⚡ Elle eklenmesi gereken secretlar:" -ForegroundColor Yellow
Write-Host "  RAILWAY_TOKEN             → railway.app → Account → Tokens"
Write-Host "  ANDROID_KEYSTORE_BASE64   → base64 -w 0 clipla-release.jks"
Write-Host "  ANDROID_KEY_PROPERTIES    → key.properties içeriği (base64 gerekmez)"
Write-Host "  GOOGLE_SERVICE_ACCOUNT_JSON → Play Console → API access → Service account"
Write-Host ""
Write-Host "✅ Tamamlandı!" -ForegroundColor Green
