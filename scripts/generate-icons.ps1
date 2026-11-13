Add-Type -AssemblyName System.Drawing
$srcPath = 'D:\Antigravity.google\TrackUP\public\assets\trackup-logo.jpg'
$src = [System.Drawing.Image]::FromFile($srcPath)

function Create-SquareIcon([int]$size, [string]$destPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#101014'))
    $g.FillRectangle($brush, 0, 0, $size, $size)

    # Scale to fit inside 85% safe zone for maskable compatibility
    $targetDim = [int]($size * 0.85)
    $scale = [Math]::Min($targetDim / $src.Width, $targetDim / $src.Height)
    $drawW = [int]($src.Width * $scale)
    $drawH = [int]($src.Height * $scale)
    $drawX = [int](($size - $drawW) / 2)
    $drawY = [int](($size - $drawH) / 2)

    $g.DrawImage($src, $drawX, $drawY, $drawW, $drawH)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created icon: $destPath"
}

Create-SquareIcon 192 'D:\Antigravity.google\TrackUP\public\assets\icon-192x192.png'
Create-SquareIcon 512 'D:\Antigravity.google\TrackUP\public\assets\icon-512x512.png'
$src.Dispose()
