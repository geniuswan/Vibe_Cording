[CmdletBinding()]
param(
  [int]$IntervalSeconds = 15
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$gitCandidates = @(
  'C:\Program Files\Git\cmd\git.exe',
  'C:\Program Files\Git\bin\git.exe'
)
$gitPath = $gitCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $gitPath) {
  $gitPath = (Get-Command git -ErrorAction Stop).Source
}

function Get-RepositoryStatus {
  $status = & $gitPath -C $repoRoot status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw 'Git 상태를 확인하지 못했습니다.'
  }
  return $status
}

function Has-Conflict([string[]]$status) {
  return [bool]($status | Where-Object { $_ -match '^(DD|AU|UD|UA|DU|AA|UU)' })
}

while ($true) {
  try {
    $initialStatus = Get-RepositoryStatus

    if (-not $initialStatus -or (Has-Conflict $initialStatus)) {
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    # Wait for edits to settle so one editing session becomes one commit.
    Start-Sleep -Seconds $IntervalSeconds
    $stableStatus = Get-RepositoryStatus

    if (-not $stableStatus -or (Has-Conflict $stableStatus) -or ($stableStatus -ne $initialStatus)) {
      continue
    }

    & $gitPath -C $repoRoot add --all
    if ($LASTEXITCODE -ne 0) {
      throw '변경 파일을 스테이징하지 못했습니다.'
    }

    & $gitPath -C $repoRoot diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      continue
    }

    $message = 'chore: auto-sync {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    & $gitPath -C $repoRoot commit -m $message
    if ($LASTEXITCODE -ne 0) {
      throw '자동 커밋에 실패했습니다.'
    }

    & $gitPath -C $repoRoot push origin main
  } catch {
    # Keep the watcher alive. A later edit will cause another upload attempt.
  }

  Start-Sleep -Seconds $IntervalSeconds
}
