# Mat Plan — tiny zero-dependency static file server (Windows PowerShell).
# Service workers + IndexedDB require the app to be *served* (not opened as a
# file://). This needs no Node/Python. Run:  powershell -ExecutionPolicy Bypass -File tools/serve.ps1
# then open the printed URL.
param([int]$Port = 8181, [string]$Root = "$PSScriptRoot\..", [switch]$Open)

$Root = (Resolve-Path $Root).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Mat Plan serving $Root at http://localhost:$Port/  (close this window to stop)"
if ($Open) { Start-Process "http://localhost:$Port/" }

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "application/javascript; charset=utf-8";
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8";
  ".webmanifest" = "application/manifest+json; charset=utf-8"; ".svg" = "image/svg+xml";
  ".png" = "image/png"; ".ico" = "image/x-icon"; ".woff2" = "font/woff2"; ".txt" = "text/plain"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }

    # "Publish for phone" posts the snapshot here; write it into the project folder.
    if ($req.HttpMethod -eq "POST" -and $path -eq "/publish") {
      $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $body = $reader.ReadToEnd(); $reader.Close()
      [System.IO.File]::WriteAllText((Join-Path $Root "matplan-data.json"), $body, (New-Object System.Text.UTF8Encoding($false)))
      $res.ContentType = "application/json"
      $okb = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $res.ContentLength64 = $okb.Length
      $res.OutputStream.Write($okb, 0, $okb.Length)
      $res.OutputStream.Close()
      Write-Host "PUBLISH wrote matplan-data.json"
      continue
    }

    $file = Join-Path $Root ($path.TrimStart("/").Replace("/", "\"))
    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentType = $ct
      $res.Headers.Add("Cache-Control", "no-store")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("200 " + $path)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
      Write-Host ("404 " + $path)
    }
    $res.OutputStream.Close()
  } catch {
    Write-Host ("ERR " + $_.Exception.Message)
  }
}
