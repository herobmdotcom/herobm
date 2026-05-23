Write-Host "Nuking Next.js cache, NestJS dist, and node_modules..." -ForegroundColor Cyan
$directories = Get-ChildItem -Include "node_modules", ".next", "dist" -Recurse -Directory -Force -ErrorAction SilentlyContinue

foreach ($dir in $directories) {
    if (Test-Path $dir.FullName) {
        try {
            # Use cmd.exe /c rmdir which is much more robust against long paths/locked files than Remove-Item
            cmd.exe /c "rmdir /s /q `"$($dir.FullName)`""
        } catch {
            Write-Host "Failed to cleanly remove $($dir.FullName), moving on..." -ForegroundColor Yellow
        }
    }
}

Write-Host "Removing TypeScript build info cache..." -ForegroundColor Cyan
Get-ChildItem -Include "*.tsbuildinfo" -Recurse -File -Force -ErrorAction SilentlyContinue | Remove-Item -Force


Write-Host "Workspace cache clean." -ForegroundColor Green
