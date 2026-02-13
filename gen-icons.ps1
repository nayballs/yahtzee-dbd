Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot 'Dead by Daylight Yahtzee set.png'
$iconDir = Join-Path $PSScriptRoot 'icons'

if (!(Test-Path $iconDir)) { New-Item -ItemType Directory -Path $iconDir | Out-Null }

$src = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(
    @{ Name = 'icon-180.png'; Size = 180 },
    @{ Name = 'icon-192.png'; Size = 192 },
    @{ Name = 'icon-512.png'; Size = 512 }
)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s.Size, $s.Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $s.Size, $s.Size)
    $g.Dispose()
    $outPath = Join-Path $iconDir $s.Name
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $($s.Name) ($($s.Size)x$($s.Size))"
}

$src.Dispose()
Write-Host "Done!"
