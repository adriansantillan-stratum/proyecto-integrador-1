param([ValidateSet('Create','Start','Verify')][string]$Mode = 'Verify')
$ErrorActionPreference = 'Stop'
$taskRepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$taskFixturePath = Join-Path $PSScriptRoot 'emulator_fixture.json'
$taskBase = 'http://127.0.0.1:8081'
$taskIdentity = 'http://127.0.0.1:8080/realms/ecoroute/protocol/openid-connect'
$taskSetup = Get-Content -Raw -LiteralPath (Join-Path $taskRepoRoot 'setup-keycloak.ps1')
$taskAdminMatch = [regex]::Match($taskSetup, '--username admin --new-password ([^\s]+)')
if (-not $taskAdminMatch.Success) { throw 'Credencial local de prueba no encontrada' }
$taskToken = Invoke-RestMethod -Method Post -Uri "$taskIdentity/token" -Body @{
  client_id = 'mobile-app'; grant_type = 'password'; username = 'admin'; password = $taskAdminMatch.Groups[1].Value
}
$taskHeaders = @{ Authorization = "Bearer $($taskToken.access_token)" }
function Invoke-MobileFixtureApi([string]$method, [string]$path, $body = $null) {
  $taskRequest = @{ Method=$method; Uri="$taskBase$path"; Headers=$taskHeaders }
  if ($null -ne $body) { $taskRequest.Body = ConvertTo-Json -Depth 8 -InputObject $body; $taskRequest.ContentType = 'application/json' }
  $taskResponse = Invoke-RestMethod @taskRequest
  if ($taskResponse -is [array]) {
    foreach ($taskItem in $taskResponse) { Write-Output $taskItem }
  } else { Write-Output $taskResponse }
}
try {
  if ($Mode -eq 'Create' -and -not (Test-Path -LiteralPath $taskFixturePath)) {
    $taskVehicles = @(Invoke-MobileFixtureApi 'Get' '/vehicles')
    $taskPlate = 'MOB-419'
    $taskPlateIndex = 419
    while ($taskVehicles.plateNumber -contains $taskPlate) { $taskPlateIndex++; $taskPlate = 'MOB-' + $taskPlateIndex }
    $taskVehicle = Invoke-MobileFixtureApi 'Post' '/vehicles' @{
      plateNumber=$taskPlate; model='SINTETICO MOBILE E2E'; brand='AUDITORIA'; capacityKg=1000; capacityM3=10; isActive=$true
    }
    $taskDate = [datetime]'2099-10-19'
    $taskRoutes = @(Invoke-MobileFixtureApi 'Get' '/routes')
    while (@($taskRoutes | Where-Object { $_.driverId -eq 1 -and $_.routeDate -eq $taskDate.ToString('yyyy-MM-dd') -and $_.status -in @('PLANNED','IN_PROGRESS') }).Count -gt 0) { $taskDate = $taskDate.AddDays(1) }
    $taskRoute = Invoke-MobileFixtureApi 'Post' '/routes' @{ driverId=1; vehicleId=$taskVehicle.id; routeDate=$taskDate.ToString('yyyy-MM-dd') }
    $taskFixture = @{ label='SINTETICO MOBILE E2E 20261019'; driverId=1; vehicleId=$taskVehicle.id; plateNumber=$taskPlate; routeId=$taskRoute.id; routeDate=$taskRoute.routeDate; orders=@() }
    [System.IO.File]::WriteAllText($taskFixturePath, (ConvertTo-Json -Depth 8 $taskFixture))
  }
  if ($Mode -eq 'Create') {
    $taskFixture = Get-Content -Raw -LiteralPath $taskFixturePath | ConvertFrom-Json
    $taskRoute = @(Invoke-MobileFixtureApi 'Get' '/routes') | Where-Object { $_.id -eq $taskFixture.routeId }
    foreach ($taskSuffix in @('OFFLINE','FALLO')) {
      $taskKnown = @($taskFixture.orders | Where-Object { $_.scenario -eq $taskSuffix })
      if ($taskKnown.Count -gt 0) {
        $taskOrder = Invoke-MobileFixtureApi 'Get' "/orders/$($taskKnown[0].id)"
        if ($taskOrder.routeId -eq $taskRoute.id) { continue }
      } else {
      $taskRecovered = @(Invoke-MobileFixtureApi 'Get' '/orders') | Where-Object {
        $_.trackingNumber -like 'MOB-E2E-*' -and $_.externalReference -eq 'SINTETICO MOBILE E2E - NO REPARTO REAL' -and
        $_.recipientName -eq "SINTETICO MOBILE $taskSuffix" -and $null -eq $_.routeId -and
        [datetimeoffset]::Parse($_.createdAt) -ge [datetimeoffset]::Parse($taskRoute.createdAt)
      }
      if (@($taskRecovered).Count -gt 1) { throw 'Mas de un pedido sintetico recuperable; requiere inspeccion de IDs' }
      if (@($taskRecovered).Count -eq 1) { $taskOrder = $taskRecovered } else {
      $taskOrder = Invoke-MobileFixtureApi 'Post' '/orders' @{
        trackingNumber="MOB-E2E-$(Get-Date -Format yyyyMMddHHmmss)-$taskSuffix"; externalReference='SINTETICO MOBILE E2E - NO REPARTO REAL';
        recipientName="SINTETICO MOBILE $taskSuffix"; recipientPhone='999999999'; recipientEmail='mobile-audit@example.invalid';
        deliveryAddress='SINTETICO - Lima, prueba sin entrega real'; deliveryCity='Lima'; deliveryDistrict='Lima';
        latitude=-12.0464; longitude=-77.0428; priority=1
      }
      }
      $taskFixture.orders = @($taskFixture.orders) + @{ id=$taskOrder.id; trackingNumber=$taskOrder.trackingNumber; scenario=$taskSuffix }
      [System.IO.File]::WriteAllText($taskFixturePath, (ConvertTo-Json -Depth 8 $taskFixture))
      }
      $null = Invoke-MobileFixtureApi 'Patch' "/orders/$($taskOrder.id)/business-data" @{
        recipientRuc='20123456789'; customerAccepted=$true; addressVerified=$true; coverageVerified=$true;
        agreementNote='DATOS SINTETICOS para prueba movil offline autorizada; no servicio real'
      }
      $null = Invoke-MobileFixtureApi 'Patch' "/orders/$($taskOrder.id)/route" @{ routeId=[long]$taskFixture.routeId }
    }
    $null = Invoke-MobileFixtureApi 'Post' "/routes/$($taskRoute.id)/review" @{
      capacityVerified=$true; windowsVerified=$true; vehicleChecked=$true; loadWeightKg=2;
      note='SINTETICO MOBILE E2E: hoja preparada para aceptacion desde la app'
    }
  }
  if (-not (Test-Path -LiteralPath $taskFixturePath)) { throw 'Primero ejecute Create para preparar solo datos sinteticos propios' }
  $taskFixture = Get-Content -Raw -LiteralPath $taskFixturePath | ConvertFrom-Json
  if ($Mode -eq 'Start') {
    $taskReview = Invoke-MobileFixtureApi 'Get' "/routes/$($taskFixture.routeId)/review"
    if (-not $taskReview.accepted) { throw 'La hoja debe aceptarse primero desde la app movil' }
    $null = Invoke-MobileFixtureApi 'Patch' "/routes/$($taskFixture.routeId)/status?status=IN_PROGRESS"
  }
  $taskReview = Invoke-MobileFixtureApi 'Get' "/routes/$($taskFixture.routeId)/review"
  $taskStates = foreach ($taskOrder in $taskFixture.orders) {
    $taskActual = Invoke-MobileFixtureApi 'Get' "/orders/$($taskOrder.id)"
    $taskProof = $null
    try { $taskProof = Invoke-MobileFixtureApi 'Get' "/delivery-proofs/$($taskOrder.id)" } catch {
      if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
    }
    @{ id=$taskActual.id; trackingNumber=$taskActual.trackingNumber; status=$taskActual.status; proofId=$taskProof.id;
      proofLatitude=$taskProof.latitude; proofLongitude=$taskProof.longitude; receiverName=$taskProof.receiverName }
  }
  @{ fixture=$taskFixture; approved=$taskReview.approved; accepted=$taskReview.accepted; states=@($taskStates) } | ConvertTo-Json -Depth 8
} finally {
  try { $null = Invoke-RestMethod -Method Post -Uri "$taskIdentity/logout" -Body @{ client_id='mobile-app'; refresh_token=$taskToken.refresh_token } } catch { Write-Warning 'No se pudo confirmar revocacion de la sesion API de prueba' }
}
