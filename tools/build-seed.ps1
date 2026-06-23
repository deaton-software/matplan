# Parse the ROSTERS sheet of "Wrestling Scouting.xlsx" into js/seed.js for Mat Plan.
# Five team blocks of 4 columns each (weight, name, grade, rating). Single listed
# weight per wrestler -> a point range {min:w, max:w} the coach can widen later.
param(
  [string]$Xlsx = "C:\Users\david\OneDrive\Documents\Wrestling Scouting.xlsx",
  [string]$Out  = "C:\Users\david\Claude\Projects\Claude Wrestling\js\seed.js"
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Xlsx)
function ReadEntry($name) {
  $e = $zip.Entries | Where-Object { $_.FullName -eq $name }
  $sr = New-Object System.IO.StreamReader($e.Open()); $t = $sr.ReadToEnd(); $sr.Close(); return $t
}
[xml]$ssx = ReadEntry("xl/sharedStrings.xml")
$strings = @(); foreach ($si in $ssx.sst.si) { $strings += [string]$si.InnerText }
function ColIndex($ref) {
  $letters = ($ref -replace '[0-9]', ''); $idx = 0
  foreach ($ch in $letters.ToCharArray()) { $idx = $idx * 26 + ([int][char]$ch - 64) }; return $idx
}
[xml]$sh = ReadEntry("xl/worksheets/sheet3.xml")
$rows = @()
foreach ($row in $sh.worksheet.sheetData.row) {
  $cells = @{}
  foreach ($c in $row.c) {
    if (-not $c.r) { continue }
    $val = $null
    if ($c.t -eq 's') { if ($c.v -ne $null) { $val = $strings[[int]$c.v] } }
    elseif ($c.t -eq 'inlineStr') { $val = $c.is.InnerText }
    elseif ($c.v -ne $null) { $val = [string]$c.v }
    if ($val -ne $null) { $cells[(ColIndex($c.r))] = ($val -replace '\s+', ' ').Trim() }
  }
  $rows += , $cells
}
$zip.Dispose()

$W = @(106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285)
$blocks = @(
  @{ name = 'Wesleyan';     col = 1;  ours = $true },
  @{ name = 'Mt. Pisgah';   col = 5;  ours = $false },
  @{ name = 'Mount Vernon'; col = 9;  ours = $false },
  @{ name = 'Fellowship';   col = 13; ours = $false },
  @{ name = 'St. Francis';  col = 17; ours = $false }
)

$teams = @()
foreach ($b in $blocks) {
  $list = @()
  foreach ($cells in $rows) {
    $wcell = [string]$cells[$b.col]
    $name = [string]$cells[$b.col + 1]
    if (-not $name) { continue }
    if ($wcell -notmatch '(\d{2,3})') { continue }
    $w = [int]$Matches[1]
    if ($W -notcontains $w) { continue }
    $gradeRaw = [string]$cells[$b.col + 2]
    $grade = if ($gradeRaw -match '^(9|10|11|12)$') { [int]$gradeRaw } else { '' }
    $rating = [string]$cells[$b.col + 3]
    if (-not $rating) { $rating = '?' }
    $list += [ordered]@{ name = $name; grade = $grade; rating = $rating; notes = ''; weight = [ordered]@{ type = 'range'; min = $w; max = $w } }
  }
  $teams += [ordered]@{ name = $b.name; isOurs = $b.ours; wrestlers = $list }
  Write-Output ("{0,-14} {1} wrestlers" -f $b.name, $list.Count)
}

$seed = [ordered]@{ tag = 'wrestling-scouting-2025'; teams = $teams }
$json = $seed | ConvertTo-Json -Depth 8
$nl = [char]10
$header = "/* Mat Plan seed data - auto-generated from Wrestling Scouting.xlsx (ROSTERS sheet)." + $nl +
          "   Applied once by store.init() when state.seedTag != MP.SEED.tag (see store.js)." + $nl +
          "   Regenerate with tools/build-seed.ps1. */" + $nl +
          "window.MP = window.MP || {};" + $nl +
          "MP.SEED = "
[System.IO.File]::WriteAllText($Out, $header + $json + ";`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("-> wrote " + $Out)
