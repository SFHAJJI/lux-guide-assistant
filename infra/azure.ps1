#Requires -Version 7.0
<#
.SYNOPSIS
  Idempotent Azure infrastructure for the lux-guide-assistant proxy (a Node 22 HTTP service).

.DESCRIPTION
  Everything lives in resource group rg-lex-v3 and reuses the existing managed environment,
  container registry and user-assigned identity. Nothing here touches ca-lex-v3 (production).

  Actions (run in the order given; each is safe to repeat):
    -EnsureContainerApp   create container app ca-lux-assistant if absent, reconcile its env vars
                          and ingress port (the placeholder quickstart listens on 80 and ignores
                          PORT, so ingress targets 80 until a real proxy image is deployed)
    -EnsureOpenAI         create the Azure OpenAI account + deployments and wire the app to them
                          (skipped with a message while Microsoft.CognitiveServices is NotRegistered)
    -DeployTag <tag>      build proxy/Dockerfile into the registry and roll the app to that image
    -Status               print FQDN, revision, image and whether the OpenAI account exists

.EXAMPLE
  pwsh -File infra/azure.ps1 -EnsureContainerApp
  pwsh -File infra/azure.ps1 -EnsureOpenAI
  pwsh -File infra/azure.ps1 -DeployTag 2026-10-31a
  pwsh -File infra/azure.ps1 -Status

.NOTES
  Requires: az CLI logged in as a principal with Contributor on rg-lex-v3, the containerapp extension.
  Secret values are never printed; only secret names appear in the output.
#>
[CmdletBinding()]
param(
  [switch]$EnsureContainerApp,
  [switch]$EnsureOpenAI,
  [string]$DeployTag,
  [switch]$Status,

  [string]$Subscription = '5faa945a-3104-4d6e-90ea-bf9cbbabb31a',
  [string]$ResourceGroup = 'rg-lex-v3',
  [string]$AppName = 'ca-lux-assistant',
  [string]$EnvironmentName = 'cae-lex-v3',
  [string]$RegistryName = 'crlexv3soufien',
  [string]$IdentityName = 'id-lex-v3',
  [string]$ImageRepository = 'lux-guide-assistant-proxy',
  [string]$PlaceholderImage = 'mcr.microsoft.com/k8se/quickstart:latest',
  [int]$PlaceholderPort = 80,
  [int]$TargetPort = 8787,
  [int]$MinReplicas = 1,
  [int]$MaxReplicas = 2,
  [string]$Cpu = '0.25',
  [string]$Memory = '0.5Gi',
  [string]$AllowedOrigins = 'https://sfhajji.github.io,https://lux-guide.github.io,http://localhost:8941,http://localhost:8787',
  [int]$DailyCap = 600,
  [int]$RatePerMin = 20,
  [string]$LlmProvider = 'azure',
  [string]$ApiKeySecretName = 'llm-api-key',

  [string]$OpenAIName = 'oai-lux-assistant',
  [string[]]$OpenAILocations = @('francecentral', 'swedencentral', 'westeurope'),
  [string]$ChatModel = 'gpt-4.1-mini',
  [string]$ChatSku = 'GlobalStandard',
  [int]$ChatCapacity = 50,
  [string]$EmbedModel = 'text-embedding-3-small',
  [string]$EmbedSku = 'Standard',
  [int]$EmbedCapacity = 50,
  [string]$ApiVersion = '2024-10-21'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RegistryServer = "$RegistryName.azurecr.io"
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

# ---------------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------------

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Note([string]$Message) { Write-Host "    $Message" }
function Write-Warn([string]$Message) { Write-Host "    WARNING: $Message" -ForegroundColor Yellow }

# Runs `az` with the given arguments. Returns a hashtable: Ok, Code, Out (stdout), Err (stderr).
# Never throws, so callers decide what a failure means. Pass -Secret to keep the argument list
# out of any diagnostic output (used when a secret value travels on the command line).
function Invoke-Az {
  param(
    [Parameter(Mandatory)][string[]]$Arguments,
    [switch]$Secret
  )
  $ErrorActionPreference = 'Continue'
  $all = $Arguments + @('--subscription', $Subscription, '--only-show-errors')
  $raw = & az @all 2>&1
  $code = $LASTEXITCODE
  $stdout = @(); $stderr = @()
  foreach ($line in $raw) {
    if ($line -is [System.Management.Automation.ErrorRecord]) { $stderr += $line.ToString() } else { $stdout += [string]$line }
  }
  $result = @{ Ok = ($code -eq 0); Code = $code; Out = ($stdout -join "`n"); Err = ($stderr -join "`n") }
  if (-not $result.Ok -and -not $Secret) {
    $result.Command = 'az ' + ($Arguments -join ' ')
  }
  return $result
}

# Runs `az ... -o json` and returns the parsed object, or $null when the command fails.
function Get-AzJson {
  param([Parameter(Mandatory)][string[]]$Arguments)
  $r = Invoke-Az -Arguments ($Arguments + @('-o', 'json'))
  if (-not $r.Ok) { return $null }
  if ([string]::IsNullOrWhiteSpace($r.Out)) { return $null }
  return ($r.Out | ConvertFrom-Json -Depth 50)
}

# Throws with the exact az error text when a required command fails.
function Assert-Az {
  param([Parameter(Mandatory)][hashtable]$Result, [Parameter(Mandatory)][string]$What)
  if ($Result.Ok) { return }
  $detail = if ($Result.Err) { $Result.Err } else { $Result.Out }
  throw "$What failed (exit $($Result.Code)):`n$detail"
}

function Get-RegistryId { "/subscriptions/$Subscription/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$RegistryName" }

function Get-ContainerApp {
  Get-AzJson -Arguments @('containerapp', 'show', '-n', $AppName, '-g', $ResourceGroup)
}

function Get-ProviderState([string]$Namespace) {
  $r = Invoke-Az -Arguments @('provider', 'show', '-n', $Namespace, '--query', 'registrationState', '-o', 'tsv')
  if ($r.Ok) { return $r.Out.Trim() }
  return "Unknown ($($r.Err))"
}

# Decides how the container app authenticates to the registry.
# Preferred: the existing user-assigned identity, if it already has AcrPull on the registry.
# Fallback: the registry's admin user, only if admin is already enabled (we never enable it).
# Otherwise: report and return $null.
function Resolve-RegistryAuth {
  $acr = Get-AzJson -Arguments @('acr', 'show', '-n', $RegistryName, '-g', $ResourceGroup)
  if (-not $acr) { throw "Registry $RegistryName not found in $ResourceGroup." }
  $identity = Get-AzJson -Arguments @('identity', 'show', '-n', $IdentityName, '-g', $ResourceGroup)
  if ($identity) {
    $assignments = Get-AzJson -Arguments @('role', 'assignment', 'list', '--scope', $acr.id, '--include-inherited',
      '--query', "[?principalId=='$($identity.principalId)' && (roleDefinitionName=='AcrPull' || roleDefinitionName=='AcrPush' || roleDefinitionName=='Owner' || roleDefinitionName=='Contributor')].roleDefinitionName")
    if ($assignments -and @($assignments).Count -gt 0) {
      Write-Note "Registry auth: user-assigned identity $IdentityName has $(@($assignments) -join ', ') on $RegistryName."
      return @{ Mode = 'identity'; IdentityId = $identity.id; Server = $acr.loginServer }
    }
    Write-Note "Identity $IdentityName has no AcrPull on $RegistryName."
  }
  else {
    Write-Note "Identity $IdentityName not found."
  }
  if ($acr.adminUserEnabled) {
    Write-Note "Registry auth: admin user is already enabled on $RegistryName; using it."
    $creds = Get-AzJson -Arguments @('acr', 'credential', 'show', '-n', $RegistryName)
    return @{ Mode = 'admin'; Server = $acr.loginServer; Username = $creds.username; Password = $creds.passwords[0].value }
  }
  Write-Warn "No usable registry auth: $IdentityName lacks AcrPull and the admin user is disabled (not enabling it)."
  Write-Warn "Owner action: az role assignment create --assignee-object-id <principalId of $IdentityName> --assignee-principal-type ServicePrincipal --role AcrPull --scope $($acr.id)"
  return $null
}

# The non-secret environment the proxy expects. Secret-backed entries use 'secretref:<name>'.
function Get-DesiredEnv {
  [ordered]@{
    PORT            = "$TargetPort"
    ALLOWED_ORIGINS = $AllowedOrigins
    DAILY_CAP       = "$DailyCap"
    RATE_PER_MIN    = "$RatePerMin"
    LLM_PROVIDER    = $LlmProvider
    LLM_API_KEY     = "secretref:$ApiKeySecretName"
  }
}

# The ingress target port the app should have right now: the placeholder image listens on
# $PlaceholderPort (the quickstart ignores PORT); the real proxy listens on $TargetPort.
function Get-WantedTargetPort([object]$App) {
  $image = $App.properties.template.containers[0].image
  if ($image -eq $PlaceholderImage) { return $PlaceholderPort }
  return $TargetPort
}

# Aligns the ingress target port with the running image. Returns $true when it changed something.
function Ensure-TargetPort([object]$App) {
  $wanted = Get-WantedTargetPort $App
  $current = [int]$App.properties.configuration.ingress.targetPort
  if ($current -eq $wanted) { Write-Note "Ingress target port already $current."; return $false }
  Write-Note "Ingress target port is $current; setting $wanted for image $($App.properties.template.containers[0].image)."
  $r = Invoke-Az -Arguments @('containerapp', 'ingress', 'update', '-n', $AppName, '-g', $ResourceGroup, '--target-port', "$wanted")
  Assert-Az -Result $r -What "az containerapp ingress update --target-port $wanted"
  return $true
}

function ConvertTo-EnvArgs([System.Collections.IDictionary]$Env) {
  @($Env.Keys | ForEach-Object { "$_=$($Env[$_])" })
}

# Compares the app's current env with the desired entries; returns the entries that differ.
function Get-EnvDrift([object]$App, [System.Collections.IDictionary]$Desired) {
  $current = @{}
  $containers = $App.properties.template.containers
  if ($containers -and $containers.Count -gt 0 -and $containers[0].PSObject.Properties['env'] -and $containers[0].env) {
    foreach ($e in $containers[0].env) {
      $hasSecret = $e.PSObject.Properties['secretRef'] -and $e.secretRef
      $current[$e.name] = if ($hasSecret) { "secretref:$($e.secretRef)" } else { [string]$e.value }
    }
  }
  $drift = [ordered]@{}
  foreach ($k in $Desired.Keys) {
    if (-not $current.ContainsKey($k) -or $current[$k] -ne $Desired[$k]) { $drift[$k] = $Desired[$k] }
  }
  return $drift
}

# ---------------------------------------------------------------------------------------------
# Ensure-ContainerApp
# ---------------------------------------------------------------------------------------------

function Ensure-ContainerApp {
  Write-Step "Ensure container app $AppName in $EnvironmentName ($ResourceGroup)"

  $managedEnv = Get-AzJson -Arguments @('containerapp', 'env', 'show', '-n', $EnvironmentName, '-g', $ResourceGroup)
  if (-not $managedEnv) { throw "Managed environment $EnvironmentName not found in $ResourceGroup." }

  $app = Get-ContainerApp
  $desiredEnv = Get-DesiredEnv

  if (-not $app) {
    $auth = Resolve-RegistryAuth
    $args = @(
      'containerapp', 'create',
      '-n', $AppName, '-g', $ResourceGroup,
      '--environment', $EnvironmentName,
      '--image', $PlaceholderImage,
      '--ingress', 'external', '--target-port', "$PlaceholderPort",
      '--min-replicas', "$MinReplicas", '--max-replicas', "$MaxReplicas",
      '--cpu', $Cpu, '--memory', $Memory,
      '--secrets', "$ApiKeySecretName=unset",
      '--env-vars'
    ) + (ConvertTo-EnvArgs $desiredEnv)
    $secretOnCommandLine = $false
    switch ($auth.Mode) {
      'identity' {
        $args += @('--registry-server', $auth.Server, '--registry-identity', $auth.IdentityId, '--user-assigned', $auth.IdentityId)
      }
      'admin' {
        $args += @('--registry-server', $auth.Server, '--registry-username', $auth.Username, '--registry-password', $auth.Password)
        $secretOnCommandLine = $true
      }
      default {
        Write-Warn "Creating $AppName without registry credentials; private images will not pull until that is fixed."
      }
    }
    Write-Note "Creating $AppName with placeholder image $PlaceholderImage ..."
    $r = Invoke-Az -Arguments $args -Secret:$secretOnCommandLine
    Assert-Az -Result $r -What "az containerapp create $AppName"
    $app = Get-ContainerApp
    Write-Note "Created. Secret '$ApiKeySecretName' holds the placeholder value until Ensure-OpenAI runs."
  }
  else {
    Write-Note "$AppName already exists (provisioning $($app.properties.provisioningState))."
    # Make sure the secret placeholder exists so the env secretref is valid.
    $secrets = Get-AzJson -Arguments @('containerapp', 'secret', 'list', '-n', $AppName, '-g', $ResourceGroup)
    $hasSecret = $secrets -and @($secrets | Where-Object { $_.name -eq $ApiKeySecretName }).Count -gt 0
    if (-not $hasSecret) {
      Write-Note "Secret '$ApiKeySecretName' missing; creating it with a placeholder value."
      $r = Invoke-Az -Arguments @('containerapp', 'secret', 'set', '-n', $AppName, '-g', $ResourceGroup, '--secrets', "$ApiKeySecretName=unset") -Secret
      Assert-Az -Result $r -What "az containerapp secret set $ApiKeySecretName"
    }
    $drift = Get-EnvDrift -App $app -Desired $desiredEnv
    if ($drift.Count -gt 0) {
      Write-Note "Env vars out of date: $($drift.Keys -join ', '); updating."
      $r = Invoke-Az -Arguments (@('containerapp', 'update', '-n', $AppName, '-g', $ResourceGroup, '--set-env-vars') + (ConvertTo-EnvArgs $drift))
      Assert-Az -Result $r -What "az containerapp update --set-env-vars"
      $app = Get-ContainerApp
    }
    else {
      Write-Note "Env vars already match."
    }
    if (Ensure-TargetPort $app) { $app = Get-ContainerApp }
  }

  $fqdn = $app.properties.configuration.ingress.fqdn
  Write-Host "FQDN: https://$fqdn" -ForegroundColor Green
  return $fqdn
}

# ---------------------------------------------------------------------------------------------
# Ensure-OpenAI
# ---------------------------------------------------------------------------------------------

function Find-OpenAILocation {
  foreach ($loc in $OpenAILocations) {
    $models = Get-AzJson -Arguments @('cognitiveservices', 'model', 'list', '-l', $loc,
      '--query', "[?kind=='OpenAI' && (model.name=='$ChatModel' || model.name=='$EmbedModel')].{name:model.name,version:model.version,isDefault:model.isDefaultVersion}")
    $chat = @($models | Where-Object { $_.name -eq $ChatModel })
    $embed = @($models | Where-Object { $_.name -eq $EmbedModel })
    Write-Note "$loc : $ChatModel versions [$(($chat | ForEach-Object { $_.version }) -join ', ')], $EmbedModel versions [$(($embed | ForEach-Object { $_.version }) -join ', ')]"
    if ($chat.Count -gt 0) {
      $pick = { param($list) ($list | Where-Object { $_.isDefault } | Select-Object -First 1) ?? ($list | Sort-Object version -Descending | Select-Object -First 1) }
      return @{
        Location     = $loc
        ChatVersion  = (& $pick $chat).version
        EmbedVersion = if ($embed.Count -gt 0) { (& $pick $embed).version } else { $null }
      }
    }
  }
  return $null
}

function Ensure-Deployment {
  param([string]$Name, [string]$ModelName, [string]$ModelVersion, [string]$Sku, [int]$Capacity)
  $existing = Get-AzJson -Arguments @('cognitiveservices', 'account', 'deployment', 'show', '-n', $OpenAIName, '-g', $ResourceGroup, '--deployment-name', $Name)
  if ($existing) {
    Write-Note "Deployment $Name exists ($($existing.properties.model.name) $($existing.properties.model.version), $($existing.sku.name) $($existing.sku.capacity))."
    return
  }
  if (-not $ModelVersion) { Write-Warn "Model $ModelName is not offered in this location; skipping deployment $Name."; return }
  Write-Note "Creating deployment $Name = $ModelName $ModelVersion ($Sku, capacity $Capacity) ..."
  $r = Invoke-Az -Arguments @('cognitiveservices', 'account', 'deployment', 'create', '-n', $OpenAIName, '-g', $ResourceGroup,
    '--deployment-name', $Name, '--model-name', $ModelName, '--model-version', $ModelVersion, '--model-format', 'OpenAI',
    '--sku-name', $Sku, '--sku-capacity', "$Capacity")
  Assert-Az -Result $r -What "az cognitiveservices account deployment create $Name"
}

function Ensure-OpenAI {
  Write-Step "Ensure Azure OpenAI account $OpenAIName and wire $AppName to it"

  $state = Get-ProviderState 'Microsoft.CognitiveServices'
  if ($state -ne 'Registered') {
    Write-Warn "Skipped: resource provider Microsoft.CognitiveServices is '$state' on subscription $Subscription."
    Write-Warn "This identity is Contributor on $ResourceGroup only and cannot register providers (subscription scope)."
    Write-Warn "Owner command to unblock: az provider register --namespace Microsoft.CognitiveServices --subscription $Subscription --wait"
    Write-Warn "Then rerun: pwsh -File $($MyInvocation.ScriptName) -EnsureOpenAI"
    return $false
  }

  $account = Get-AzJson -Arguments @('cognitiveservices', 'account', 'show', '-n', $OpenAIName, '-g', $ResourceGroup)
  $chatVersion = $null; $embedVersion = $null
  if (-not $account) {
    $pick = Find-OpenAILocation
    if (-not $pick) { throw "Model $ChatModel is not available in any of: $($OpenAILocations -join ', ')." }
    Write-Note "Creating $OpenAIName (kind OpenAI, sku S0, subdomain $OpenAIName) in $($pick.Location) ..."
    $r = Invoke-Az -Arguments @('cognitiveservices', 'account', 'create', '-n', $OpenAIName, '-g', $ResourceGroup, '-l', $pick.Location,
      '--kind', 'OpenAI', '--sku', 'S0', '--custom-domain', $OpenAIName, '--yes')
    Assert-Az -Result $r -What "az cognitiveservices account create $OpenAIName"
    $account = Get-AzJson -Arguments @('cognitiveservices', 'account', 'show', '-n', $OpenAIName, '-g', $ResourceGroup)
    $chatVersion = $pick.ChatVersion; $embedVersion = $pick.EmbedVersion
  }
  else {
    Write-Note "$OpenAIName exists in $($account.location) (endpoint $($account.properties.endpoint))."
    $saved = $OpenAILocations
    $script:OpenAILocations = @($account.location)
    $pick = Find-OpenAILocation
    $script:OpenAILocations = $saved
    if ($pick) { $chatVersion = $pick.ChatVersion; $embedVersion = $pick.EmbedVersion }
  }

  Ensure-Deployment -Name $ChatModel -ModelName $ChatModel -ModelVersion $chatVersion -Sku $ChatSku -Capacity $ChatCapacity
  Ensure-Deployment -Name $EmbedModel -ModelName $EmbedModel -ModelVersion $embedVersion -Sku $EmbedSku -Capacity $EmbedCapacity

  $app = Get-ContainerApp
  if (-not $app) { Write-Warn "$AppName does not exist yet; run -EnsureContainerApp first."; return $false }

  Write-Note "Setting secret '$ApiKeySecretName' on $AppName from the account's key1 (value not shown) ..."
  $keys = Invoke-Az -Arguments @('cognitiveservices', 'account', 'keys', 'list', '-n', $OpenAIName, '-g', $ResourceGroup, '--query', 'key1', '-o', 'tsv') -Secret
  Assert-Az -Result $keys -What "az cognitiveservices account keys list"
  $key1 = $keys.Out.Trim()
  if (-not $key1) { throw "key1 of $OpenAIName came back empty." }
  $r = Invoke-Az -Arguments @('containerapp', 'secret', 'set', '-n', $AppName, '-g', $ResourceGroup, '--secrets', "$ApiKeySecretName=$key1") -Secret
  if (-not $r.Ok) { throw "az containerapp secret set $ApiKeySecretName failed (exit $($r.Code)): $($r.Err)" }
  $key1 = $null

  $wanted = [ordered]@{
    LLM_PROVIDER    = $LlmProvider
    LLM_ENDPOINT    = $account.properties.endpoint
    LLM_MODEL       = $ChatModel
    LLM_EMBED_MODEL = $EmbedModel
    LLM_API_VERSION = $ApiVersion
    LLM_API_KEY     = "secretref:$ApiKeySecretName"
  }
  $drift = Get-EnvDrift -App $app -Desired $wanted
  if ($drift.Count -gt 0) {
    Write-Note "Updating env vars: $($drift.Keys -join ', ')"
    $r = Invoke-Az -Arguments (@('containerapp', 'update', '-n', $AppName, '-g', $ResourceGroup, '--set-env-vars') + (ConvertTo-EnvArgs $drift))
    Assert-Az -Result $r -What "az containerapp update --set-env-vars (LLM_*)"
  }
  else {
    Write-Note "LLM_* env vars already match."
  }
  Write-Host "OpenAI: $OpenAIName ready; $AppName points at $($account.properties.endpoint)" -ForegroundColor Green
  return $true
}

# ---------------------------------------------------------------------------------------------
# Deploy-Proxy
# ---------------------------------------------------------------------------------------------

function Deploy-Proxy {
  param([Parameter(Mandatory)][string]$Tag)
  $image = "$script:RegistryServer/$ImageRepository`:$Tag"
  Write-Step "Deploy proxy: build $image and roll $AppName to it"

  $dockerfile = Join-Path $script:ProjectRoot 'proxy/Dockerfile'
  if (-not (Test-Path $dockerfile)) { throw "Dockerfile not found at $dockerfile" }

  Push-Location $script:ProjectRoot
  try {
    Write-Note "az acr build -r $RegistryName -t $ImageRepository`:$Tag -f proxy/Dockerfile . (context: $script:ProjectRoot)"
    $ErrorActionPreference = 'Continue'
    & az acr build -r $RegistryName -t "$ImageRepository`:$Tag" -f proxy/Dockerfile . --subscription $Subscription --only-show-errors
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "az acr build failed with exit code $code (see output above)." }
  }
  finally { Pop-Location }

  $app = Get-ContainerApp
  if (-not $app) { throw "$AppName does not exist; run -EnsureContainerApp first." }
  Write-Note "az containerapp update -n $AppName -g $ResourceGroup --image $image"
  $r = Invoke-Az -Arguments @('containerapp', 'update', '-n', $AppName, '-g', $ResourceGroup, '--image', $image)
  Assert-Az -Result $r -What "az containerapp update --image"
  $app = Get-ContainerApp
  if (Ensure-TargetPort $app) { $app = Get-ContainerApp }
  Write-Host "Deployed $image; latest revision $($app.properties.latestRevisionName); https://$($app.properties.configuration.ingress.fqdn)" -ForegroundColor Green
}

# ---------------------------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------------------------

function Show-Status {
  Write-Step "Status of $AppName and $OpenAIName in $ResourceGroup"
  $app = Get-ContainerApp
  if ($app) {
    $revisions = Get-AzJson -Arguments @('containerapp', 'revision', 'list', '-n', $AppName, '-g', $ResourceGroup,
      '--query', "[?properties.active].{name:name,traffic:properties.trafficWeight,health:properties.healthState,running:properties.runningState,replicas:properties.replicas}")
    $container = $app.properties.template.containers[0]
    $registries = @($app.properties.configuration.registries | ForEach-Object { if ($_.identity) { "$($_.server) via identity" } else { "$($_.server) via $($_.username)" } })
    Write-Host "Container app : $AppName ($($app.properties.provisioningState), $($app.properties.runningStatus))"
    Write-Host "FQDN          : https://$($app.properties.configuration.ingress.fqdn)"
    Write-Host "Latest revision: $($app.properties.latestRevisionName) (ready: $($app.properties.latestReadyRevisionName))"
    Write-Host "Image         : $($container.image)"
    Write-Host "Ingress       : $($app.properties.configuration.ingress.external ? 'external' : 'internal'), target port $($app.properties.configuration.ingress.targetPort)"
    Write-Host "Resources     : cpu $($container.resources.cpu), memory $($container.resources.memory); replicas $($app.properties.template.scale.minReplicas)-$($app.properties.template.scale.maxReplicas)"
    Write-Host "Registries    : $($registries -join '; ')"
    Write-Host "Env           : $(@($container.env | ForEach-Object { if ($_.PSObject.Properties['secretRef'] -and $_.secretRef) { "$($_.name)=secretref:$($_.secretRef)" } else { "$($_.name)=$($_.value)" } }) -join ' ')"
    foreach ($rev in @($revisions)) {
      Write-Host "Active rev    : $($rev.name) traffic=$($rev.traffic) health=$($rev.health) running=$($rev.running) replicas=$($rev.replicas)"
    }
  }
  else {
    Write-Host "Container app : $AppName absent"
  }

  $state = Get-ProviderState 'Microsoft.CognitiveServices'
  if ($state -ne 'Registered') {
    Write-Host "OpenAI account: $OpenAIName absent (provider Microsoft.CognitiveServices is $state)"
  }
  else {
    $oai = Get-AzJson -Arguments @('cognitiveservices', 'account', 'show', '-n', $OpenAIName, '-g', $ResourceGroup)
    if ($oai) {
      $deps = Get-AzJson -Arguments @('cognitiveservices', 'account', 'deployment', 'list', '-n', $OpenAIName, '-g', $ResourceGroup, '--query', '[].{name:name,model:properties.model.name,version:properties.model.version,sku:sku.name,capacity:sku.capacity}')
      Write-Host "OpenAI account: $OpenAIName exists in $($oai.location), endpoint $($oai.properties.endpoint)"
      foreach ($d in @($deps)) { Write-Host "  deployment  : $($d.name) = $($d.model) $($d.version) ($($d.sku) $($d.capacity))" }
    }
    else {
      Write-Host "OpenAI account: $OpenAIName absent (provider Registered; run -EnsureOpenAI)"
    }
  }
}

# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------

$ran = $false
if ($EnsureContainerApp) { $null = Ensure-ContainerApp; $ran = $true }
if ($EnsureOpenAI) { $null = Ensure-OpenAI; $ran = $true }
if ($DeployTag) { Deploy-Proxy -Tag $DeployTag; $ran = $true }
if ($Status) { Show-Status; $ran = $true }
if (-not $ran) {
  Write-Host "Nothing to do. Use one or more of: -EnsureContainerApp, -EnsureOpenAI, -DeployTag <tag>, -Status"
  Write-Host "See: Get-Help $($MyInvocation.MyCommand.Path) -Detailed"
}
