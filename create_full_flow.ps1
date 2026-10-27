# create_full_flow.ps1
# Flujo Completo: Driver -> Vehicle -> Route -> Order -> Delivery

$baseUrl = "http://localhost:8081"
$token = & "$PSScriptRoot\get-token.ps1"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

Write-Host "1. Creating Driver..." -ForegroundColor Cyan
$driverBody = @{
    firstName = "Carlos"
    lastName = "Sainz"
    licenseNumber = "Q12345678"
    phone = "999000111"
    isActive = $true
} | ConvertTo-Json
$driver = Invoke-RestMethod -Uri "$baseUrl/drivers" -Method Post -Body $driverBody -Headers $headers
Write-Host "Driver Created: ID $($driver.id)" -ForegroundColor Green

Write-Host "2. Creating Vehicle..." -ForegroundColor Cyan
$vehicleBody = @{
    plateNumber = "F1-2026"
    brand = "Volvo"
    model = "FH16"
    capacityKg = 20000
    isActive = $true
} | ConvertTo-Json
$vehicle = Invoke-RestMethod -Uri "$baseUrl/vehicles" -Method Post -Body $vehicleBody -Headers $headers
Write-Host "Vehicle Created: ID $($vehicle.id)" -ForegroundColor Green

Write-Host "3. Creating Route..." -ForegroundColor Cyan
$today = (Get-Date).ToString("yyyy-MM-dd")
$routeBody = @{
    driverId = $driver.id
    vehicleId = $vehicle.id
    routeDate = $today
    estimatedStartTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json
$route = Invoke-RestMethod -Uri "$baseUrl/routes" -Method Post -Body $routeBody -Headers $headers
Write-Host "Route Created: ID $($route.id)" -ForegroundColor Green

Write-Host "4. Creating Order..." -ForegroundColor Cyan
$orderBody = @{
    trackingNumber = "FULL-FLOW-001"
    externalReference = "INV-999"
    routeId = $route.id
    recipientName = "Empresa Final S.A.C."
    recipientPhone = "012345678"
    recipientEmail = "contacto@final.com"
    deliveryAddress = "Av. La Marina 2000"
    deliveryDistrict = "San Miguel"
    priority = 1
    latitude = -12.078
    longitude = -77.085
    estimatedDeliveryWindowStart = (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    estimatedDeliveryWindowEnd = (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json
$order = Invoke-RestMethod -Uri "$baseUrl/orders" -Method Post -Body $orderBody -Headers $headers
Write-Host "Order Created: ID $($order.id) - Tracking $($order.trackingNumber)" -ForegroundColor Green

Write-Host "5. Simulating Delivery (Evidence)..." -ForegroundColor Cyan
$deliveryBody = @{
    orderId = $order.id
    imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    signatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg=="
    receiverName = "Recepcionista"
    receiverDni = "40404040"
    verifiedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    latitude = -12.078
    longitude = -77.085
} | ConvertTo-Json
$proof = Invoke-RestMethod -Uri "$baseUrl/delivery-proofs" -Method Post -Body $deliveryBody -Headers $headers
Write-Host "Delivery Proof Created! Order should be DELIVERED." -ForegroundColor Green
