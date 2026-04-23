# Oman HTA WebView2 Host

This WinForms WebView2 wrapper loads `index.html` from the HTA-oman folder using a virtual HTTPS host so service workers and local assets work offline.

## Prerequisites
- .NET 8 SDK
- Microsoft Edge WebView2 Runtime

## Run (Developer)
```powershell
cd <repo-root>
# Restore + run
dotnet run --project .\webview2\OmanHTA.WebView2
```

## Build
```powershell
dotnet build .\webview2\OmanHTA.WebView2 -c Release
```

The app searches upward from its executable location until it finds `index.html`, so it can run from the build output as long as the executable remains inside the HTA-oman folder tree.
