$bytes = [IO.File]::ReadAllBytes('.env')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = $text -split "`n"
for ($i=0; $i -lt $lines.Length; $i++) {
  $line = $lines[$i]
  $bad = @()
  foreach ($ch in $line.ToCharArray()) {
    if ([int][char]$ch -gt 127) { $bad += $ch }
  }
  if ($bad.Count -gt 0) {
    Write-Host ($i + 1) ':' $line
    Write-Host '   non-ascii:' ($bad | ForEach-Object { $_ + ' ' + ('0x{0:X}' -f [int][char]$_) })
  }
}
