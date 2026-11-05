# Reads text from a part of the screen with the OCR built into Windows (Russian). Used by the card scanner (card-scan.js).
# Starts once and waits: each stdin line "<id> <x> <y> <w> <h> <scale>" (physical screen pixels) captures that area
# and prints one JSON line {"type":"frame","id":..,"lines":[{"text","x","y","r","b"}]} (coordinates in screen pixels).
# Prints {"type":"ready"} when the OCR engine is loaded. Exits when stdin closes or the parent process is gone.
# Test on an image: powershell -File ocr-server.ps1 -ImagePath shot.png [-Scale 2]
# Keep this file ASCII: Windows PowerShell 5.1 reads scripts in the ANSI code page.
param([string]$ImagePath = '', [int]$Scale = 2, [int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

function Emit($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 5)); [Console]::Out.Flush() }

try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class RqDpi2 { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
  [void][RqDpi2]::SetProcessDPIAware()
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language 'ru'))
  if (-not $engine) { Emit @{ type = 'error'; code = 'no-ru-ocr'; message = 'Russian OCR language is not installed' }; exit 2 }
} catch {
  Emit @{ type = 'error'; code = 'init'; message = $_.Exception.Message }
  exit 2
}

function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(-1)
  $task.Result
}

# OCR of a bitmap enlarged $sc times; coordinates come back in the bitmap's own pixels, shifted by $ox/$oy
function Recognize([System.Drawing.Bitmap]$src, [double]$sc, [int]$ox, [int]$oy) {
  $bw = [int]($src.Width * $sc); $bh = [int]($src.Height * $sc)
  $big = New-Object System.Drawing.Bitmap $bw, $bh
  $g = [System.Drawing.Graphics]::FromImage($big)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $bw, $bh)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $big.Save($ms, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $big.Dispose()
  $ms.Position = 0
  $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
  $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $sb = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Await ($engine.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])
  $sb.Dispose(); $ras.Dispose(); $ms.Dispose()
  $out = New-Object System.Collections.ArrayList
  foreach ($line in $res.Lines) {
    $words = @($line.Words)
    if ($words.Count -eq 0) { continue }
    $a = $words[0].BoundingRect; $z = $words[$words.Count - 1].BoundingRect
    [void]$out.Add(@{ text = $line.Text; x = $ox + [int]($a.X / $sc); y = $oy + [int]($a.Y / $sc); r = $ox + [int](($z.X + $z.Width) / $sc); b = $oy + [int](($a.Y + $a.Height) / $sc) })
  }
  return , $out
}

if ($ImagePath) {
  $img = [System.Drawing.Bitmap]::FromFile($ImagePath)
  $lines = Recognize $img $Scale 0 0
  Emit @{ type = 'frame'; id = 0; w = $img.Width; h = $img.Height; lines = $lines }
  $img.Dispose()
  exit 0
}

Emit @{ type = 'ready' }
while ($true) {
  $cmd = [Console]::In.ReadLine()
  if ($null -eq $cmd) { break }
  if ($ParentPid -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  $p = $cmd.Trim() -split '\s+'
  if ($p.Count -lt 6) { continue }
  $id = $p[0]; $x = [int]$p[1]; $y = [int]$p[2]; $w = [int]$p[3]; $h = [int]$p[4]; $sc = [double]::Parse($p[5], [Globalization.CultureInfo]::InvariantCulture)
  try {
    $cap = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gc = [System.Drawing.Graphics]::FromImage($cap)
    $gc.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
    $gc.Dispose()
    if ($p.Count -ge 7) { $cap.Save(($p[6..($p.Count - 1)] -join ' '), [System.Drawing.Imaging.ImageFormat]::Png) }
    $lines = Recognize $cap $sc $x $y
    $cap.Dispose()
    Emit @{ type = 'frame'; id = $id; lines = $lines }
  } catch {
    Emit @{ type = 'error'; id = $id; code = 'scan'; message = $_.Exception.Message }
  }
}
