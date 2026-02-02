$bytes = [IO.File]::ReadAllBytes('.env')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
  $text = $text.Substring(1)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText('.env', $text, $utf8NoBom)
