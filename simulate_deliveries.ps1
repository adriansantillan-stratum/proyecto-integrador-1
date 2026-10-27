# simulate_deliveries.ps1
$baseUrl = "http://localhost:8081/delivery-proofs"
$token = & "$PSScriptRoot\get-token.ps1"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

# 1. On-time delivery (Verified today, window also today)
$onTimeBody = @{
    orderId = 1
    imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    signatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    receiverName = "Juan Perez"
    receiverDni = "12345678"
    verifiedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    latitude = -12.046374
    longitude = -77.042793
} | ConvertTo-Json

# 2. Delayed delivery (Verified today, but window was 1 hour ago)
$delayedBody = @{
    orderId = 2
    imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    signatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    receiverName = "Maria Garcia"
    receiverDni = "87654321"
    verifiedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    latitude = -12.055
    longitude = -77.04
} | ConvertTo-Json

Write-Host "Simulating on-time delivery for Order 1..." -ForegroundColor Green
Invoke-RestMethod -Uri $baseUrl -Method Post -Body $onTimeBody -Headers $headers

Write-Host "Simulating delayed delivery for Order 2..." -ForegroundColor Red
Invoke-RestMethod -Uri $baseUrl -Method Post -Body $delayedBody -Headers $headers

Write-Host "Deliveries simulation complete!" -ForegroundColor Cyan
