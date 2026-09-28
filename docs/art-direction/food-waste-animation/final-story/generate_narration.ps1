Add-Type -AssemblyName System.Speech
$outputFolder = Join-Path $PSScriptRoot 'assets'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$lines = @(
  @{ File = 'fridge-zh.wav'; Voice = 'Microsoft Huihui Desktop'; Text = '澳洲调查估计，有三十五岁以下成员的家庭，一年丢弃约一百一十三公斤食物。先看看冰箱，让遗忘少一点。' },
  @{ File = 'fridge-en.wav'; Voice = 'Microsoft Zira Desktop'; Text = 'An Australian survey estimates that households with someone under thirty-five discard about one hundred and thirteen kilograms of food a year. Check the fridge first, and forget less.' },
  @{ File = 'shelf-zh.wav'; Voice = 'Microsoft Huihui Desktop'; Text = '购物前没看库存，计划变了，日期又看不懂。食物就这样被遗忘。下次购物前，先看看冰箱吧。' },
  @{ File = 'shelf-en.wav'; Voice = 'Microsoft Zira Desktop'; Text = 'Not checking the pantry, changing plans, and confusing date labels can leave food forgotten. Take a look at home before the next shop.' }
)
foreach ($line in $lines) {
  $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voice.SelectVoice($line.Voice)
  $voice.Rate = 2
  $voice.Volume = 100
  $voice.SetOutputToWaveFile((Join-Path $outputFolder $line.File))
  # Arthur: NarIyirm
  # 中文：按语言生成独立旁白，App 可以在切换系统语言后选择对应音轨。
  # EN: Separate language tracks let the app choose narration after a locale change.
  $voice.Speak($line.Text)
  $voice.Dispose()
  Write-Output $line.File
}
