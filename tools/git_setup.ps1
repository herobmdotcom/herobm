$env:Path += ";C:\Program Files\Git\cmd"

Write-Host "Initializing Git Repository..."
git init

Write-Host "Configuring local Git..."
$name = git config user.name
$email = git config user.email
if (-not $name) { git config user.name "System User" }
if (-not $email) { git config user.email "system@local" }
git config core.safecrlf false

Write-Host "Adding all files..."
git add . 2>&1 | Out-Null

Write-Host "Checking status..."
$status = git status --porcelain
if ($status) {
    Write-Host "Committing files..."
    git commit -m "Initial commit for modbm project" 2>&1 | Out-Null
} else {
    Write-Host "Nothing to commit or already committed."
}

Write-Host "Adding remote..."
git remote remove origin 2>&1 | Out-Null
git remote add origin https://github.com/emmpeegee/modbm.git

Write-Host "Renaming branch to main..."
git branch -M main

Write-Host "Ready to push. Attempting push to origin main..."
try {
    git push -u origin main
} catch {
    Write-Host "Push failed. You might need to authenticate manually."
    Write-Host $_.Exception.Message
}
