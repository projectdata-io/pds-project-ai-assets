Add-Type -AssemblyName System.Drawing

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$originalColor = [System.Drawing.Bitmap]::FromFile((Join-Path $root 'shared/user-ui-icons/color.png'))
$originalOutline = [System.Drawing.Bitmap]::FromFile((Join-Path $root 'shared/user-ui-icons/outline.png'))

function Draw-Glyph($graphics, $role, $originX, $originY, $scale) {
    $graphics.TranslateTransform($originX, $originY)
    $graphics.ScaleTransform($scale, $scale)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 3)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $brush = [System.Drawing.Brushes]::White
    try {
        switch ($role) {
            'teams-project-manager-assistant' {
                $graphics.DrawLine($pen, 4, 14, 10, 20)
                $graphics.DrawLine($pen, 10, 20, 24, 6)
                $graphics.DrawLine($pen, 15, 24, 25, 24)
            }
            'teams-schedule-quality-analyst' {
                $graphics.DrawEllipse($pen, 4, 4, 22, 22)
                $graphics.DrawLine($pen, 15, 7, 15, 15)
                $graphics.DrawLine($pen, 15, 15, 21, 18)
            }
            'teams-portfolio-executive-analyst' {
                $graphics.FillRectangle($brush, 4, 18, 5, 8)
                $graphics.FillRectangle($brush, 12, 12, 5, 14)
                $graphics.FillRectangle($brush, 20, 5, 5, 21)
            }
            'teams-resource-manager' {
                $graphics.FillEllipse($brush, 10, 3, 9, 9)
                $graphics.FillEllipse($brush, 2, 11, 6, 6)
                $graphics.FillEllipse($brush, 21, 11, 6, 6)
                $graphics.DrawArc($pen, 5, 13, 19, 17, 200, 140)
                $graphics.DrawLine($pen, 2, 24, 7, 23)
                $graphics.DrawLine($pen, 22, 23, 27, 24)
            }
            'teams-mpp-data-auditor' {
                $graphics.DrawEllipse($pen, 4, 3, 18, 18)
                $graphics.DrawLine($pen, 19, 20, 27, 28)
                $graphics.DrawLine($pen, 8, 12, 11, 15)
                $graphics.DrawLine($pen, 11, 15, 17, 9)
            }
        }
    } finally {
        $pen.Dispose()
        $graphics.ResetTransform()
    }
}

$roles = [ordered]@{
    'teams-project-manager-assistant' = '#E8A639'
    'teams-schedule-quality-analyst' = '#C65D50'
    'teams-portfolio-executive-analyst' = '#347DB4'
    'teams-resource-manager' = '#159C94'
    'teams-mpp-data-auditor' = '#A64E83'
}

try {
    foreach ($role in $roles.Keys) {
        $directory = Join-Path $root "shared/agent-icons/$role"
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null

        $color = [System.Drawing.Bitmap]::new(192, 192, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($color)
        try {
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.Clear([System.Drawing.Color]::FromArgb(0, 102, 51))
            $graphics.DrawImage($originalColor, [System.Drawing.Rectangle]::new(0, 19, 151, 151))
            $badge = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($roles[$role]))
            $border = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 3)
            try {
                $graphics.FillEllipse($badge, 126, 121, 59, 59)
                $graphics.DrawEllipse($border, 126, 121, 59, 59)
                Draw-Glyph $graphics $role 139 133 1.2
            } finally {
                $badge.Dispose()
                $border.Dispose()
            }
            $color.Save((Join-Path $directory 'color.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $color.Dispose()
        }

        $outline = [System.Drawing.Bitmap]::new(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($outline)
        try {
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.DrawImage($originalOutline, [System.Drawing.Rectangle]::new(0, 8, 102, 102))
            $border = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 4)
            try {
                $graphics.DrawEllipse($border, 77, 77, 46, 46)
            } finally {
                $border.Dispose()
            }
            Draw-Glyph $graphics $role 84 84 1.1
            $small = [System.Drawing.Bitmap]::new(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $smallGraphics = [System.Drawing.Graphics]::FromImage($small)
            try {
                $smallGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $smallGraphics.DrawImage($outline, [System.Drawing.Rectangle]::new(0, 0, 32, 32))
                for ($y = 0; $y -lt 32; $y++) {
                    for ($x = 0; $x -lt 32; $x++) {
                        $alpha = $small.GetPixel($x, $y).A
                        $small.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
                    }
                }
                $small.Save((Join-Path $directory 'outline.png'), [System.Drawing.Imaging.ImageFormat]::Png)
            } finally {
                $smallGraphics.Dispose()
                $small.Dispose()
            }
        } finally {
            $graphics.Dispose()
            $outline.Dispose()
        }
    }
} finally {
    $originalColor.Dispose()
    $originalOutline.Dispose()
}

Write-Output "Created $($roles.Count) role-specific Teams icon pairs."