# simulate_gps.ps1
# Simulation of GPS tracking for EcoRoute

$driverId = 1
$vehicleId = 1
$baseUrl = "http://localhost:8081/gps/ping"

# Path coordinates (Lima)
$points = @(
    @(-12.046374, -77.042793),
    @(-12.055, -77.040),
    @(-12.065, -77.035),
    @(-12.075, -77.030),
    @(-12.085, -77.025),
    @(-12.095, -77.020)
)

Write-Host "Starting GPS Simulation for Vehicle $vehicleId and Driver $driverId..." -ForegroundColor Cyan

$token = & "$PSScriptRoot\get-token.ps1"

foreach ($point in $points) {
    $lat = $point[0]
    $lon = $point[1]
    $speed = Get-Random -Minimum 30 -Maximum 50
    $heading = Get-Random -Minimum 0 -Maximum 360

    $body = @{
        vehicleId = [long]$vehicleId
        driverId = [long]$driverId
        latitude = [double]$lat
        longitude = [double]$lon
        speedKmh = [double]$speed
        headingDegrees = [int]$heading
    } | ConvertTo-Json

    Write-Host "Sending ping: Lat $lat, Lon $lon, Speed $speed km/h..." -ForegroundColor Green
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/json"
        }
        Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -Headers $headers
    } catch {
        Write-Host "Error sending ping: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
}

Write-Host "Simulation complete!" -ForegroundColor Cyan
