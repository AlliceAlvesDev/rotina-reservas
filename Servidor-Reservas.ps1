param([ValidateRange(1024, 65535)][int]$Porta = 8502)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'public'
$files = @{
    '/' = @('index.html', 'text/html; charset=utf-8')
    '/index.html' = @('index.html', 'text/html; charset=utf-8')
    '/app.js' = @('app.js', 'text/javascript; charset=utf-8')
    '/reservas.js' = @('reservas.js', 'text/javascript; charset=utf-8')
    '/style.css' = @('style.css', 'text/css; charset=utf-8')
    '/vendor/xlsx.full.min.js' = @('vendor/xlsx.full.min.js', 'text/javascript; charset=utf-8')
}
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Porta)
try {
    foreach ($entry in $files.Values) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $entry[0]) -PathType Leaf)) {
            throw 'Arquivos ausentes. Extraia todo o ZIP antes de iniciar.'
        }
    }
    $listener.Start()
    $url = "http://localhost:$Porta/"
    Write-Host "Rotina de reservas: $url" -ForegroundColor Green
    Write-Host 'Mantenha esta janela aberta. Pressione Ctrl+C para encerrar.'
    Write-Host 'Arquivos processados somente no navegador, sem envio de planilhas.'
    $chrome = @(
        (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:LOCALAPPDATA} 'Google\Chrome\Application\chrome.exe')
    )
    if (${env:ProgramFiles(x86)}) { $chrome += Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe' }
    $browser = $chrome | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    try {
        if ($browser) { Start-Process -FilePath $browser -ArgumentList $url }
        else { Start-Process $url }
    } catch { Write-Host "Abra o navegador e acesse $url" }
    while ($true) {
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 100; continue }
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 5000
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            if (-not $request) { continue }
            $parts = $request.Split(' ')
            $size = $request.Length
            do {
                $line = $reader.ReadLine()
                if ($null -ne $line) { $size += $line.Length }
                if ($size -gt 16384) { throw 'Cabecalhos HTTP muito grandes.' }
            } while ($line)
            $status = '404 Not Found'
            $type = 'text/plain; charset=utf-8'
            $body = [System.Text.Encoding]::UTF8.GetBytes('Nao encontrado.')
            $path = ($parts[1] -split '\?', 2)[0]
            if ($parts[0] -notin @('GET', 'HEAD')) {
                $status = '405 Method Not Allowed'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Somente leitura de arquivos locais. Uploads nao sao aceitos.')
            } elseif ($files.ContainsKey($path)) {
                $entry = $files[$path]
                $body = [System.IO.File]::ReadAllBytes((Join-Path $root $entry[0]))
                $type = $entry[1]
                $status = '200 OK'
            }
            $csp = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
            $header = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nContent-Security-Policy: $csp`r`n`r`n"
            $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($bytes, 0, $bytes.Length)
            if ($parts[0] -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        } catch {
            Write-Verbose 'Conexao local encerrada ou solicitacao invalida.'
        } finally { $client.Close() }
    }
} catch {
    Write-Host "Nao foi possivel iniciar: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Se a porta estiver ocupada, feche outra instancia ou execute com -Porta 8503.'
    exit 1
} finally { $listener.Stop() }
