# build_deploy.ps1 - Automated Build and Deploy Script for LearnX

$ProjectRoot = Get-Item .
$TomcatPath = "C:\xampp\tomcat"
$MySQLPath = "C:\xampp\mysql"
$WebappsPath = "$TomcatPath\webapps"
$DeployDir = "$WebappsPath\LearnX"
$LibDir = "src/main/webapp/WEB-INF/lib"
$ClassesDir = "src/main/webapp/WEB-INF/classes"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "        LearnX Build & Deploy System" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Ensure Directory Structure
Write-Host "[1/6] Setting up project directories..." -ForegroundColor Yellow
$Directories = @(
    "src/main/java/com/learnx/controller",
    "src/main/java/com/learnx/model",
    "src/main/java/com/learnx/dao",
    "src/main/java/com/learnx/util",
    "src/main/java/com/learnx/filter",
    $LibDir,
    $ClassesDir,
    "src/main/webapp/assets/css",
    "src/main/webapp/assets/js",
    "src/main/webapp/assets/images",
    "src/main/webapp/views",
    "src/main/webapp/common",
    "database",
    "python",
    "uploads/assignments",
    "uploads/materials",
    "uploads/profiles"
)

foreach ($dir in $Directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# 2. Download Dependencies
Write-Host "[2/6] Checking Java dependencies..." -ForegroundColor Yellow
$MySQLJar = "$LibDir/mysql-connector-j-8.3.0.jar"
$GsonJar = "$LibDir/gson-2.11.0.jar"

if (!(Test-Path $MySQLJar)) {
    Write-Host "   Downloading MySQL Connector/J..." -ForegroundColor DarkYellow
    $MySQLUrl = "https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar"
    Invoke-WebRequest -Uri $MySQLUrl -OutFile $MySQLJar -ErrorAction Stop
} else {
    Write-Host "   MySQL Connector/J already present." -ForegroundColor Green
}

if (!(Test-Path $GsonJar)) {
    Write-Host "   Downloading Google GSON..." -ForegroundColor DarkYellow
    $GsonUrl = "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.11.0/gson-2.11.0.jar"
    Invoke-WebRequest -Uri $GsonUrl -OutFile $GsonJar -ErrorAction Stop
} else {
    Write-Host "   Google GSON already present." -ForegroundColor Green
}

# 3. Compile Java Source Files
Write-Host "[3/6] Compiling Java classes..." -ForegroundColor Yellow
$JavaFiles = Get-ChildItem -Path "src/main/java" -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }

if ($JavaFiles.Count -eq 0) {
    Write-Host "   No Java source files found yet. Skipping compilation." -ForegroundColor Gray
} else {
    $TomcatLib = "$TomcatPath\lib"
    $Classpath = ".;$TomcatLib\servlet-api.jar;$TomcatLib\jsp-api.jar;$LibDir\mysql-connector-j-8.3.0.jar;$LibDir\gson-2.11.0.jar"
    
    # Compile with Java 17 release compatibility target
    $JavaFilesArg = $JavaFiles -join " "
    $CompileCommand = "javac --release 17 -cp `"$Classpath`" -d `"$ClassesDir`" $JavaFilesArg"
    
    Write-Host "   Running: $CompileCommand" -ForegroundColor DarkGray
    Invoke-Expression $CompileCommand
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERROR: Compilation failed!" -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Java compilation successful!" -ForegroundColor Green
}

# 4. Initialize Database
Write-Host "[4/6] Initializing MySQL Database..." -ForegroundColor Yellow
# Check if MySQL port is open
$PortOpen = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 3306)
    $PortOpen = $true
    $tcp.Close()
} catch {
    $PortOpen = $false
}

if (!$PortOpen) {
    Write-Host "   MySQL is not running. Starting MySQL server..." -ForegroundColor DarkYellow
    Start-Process -FilePath "$MySQLPath\bin\mysqld.exe" -ArgumentList "--defaults-file=$MySQLPath\bin\my.ini" -WindowStyle Hidden
    
    # Poll until MySQL starts
    $Retry = 0
    while (!$PortOpen -and $Retry -lt 15) {
        Start-Sleep -Seconds 1
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 3306)
            $PortOpen = $true
            $tcp.Close()
        } catch {
            $Retry++
        }
    }
}

if ($PortOpen) {
    Write-Host "   MySQL is running. Running schema.sql..." -ForegroundColor Green
    $SchemaFile = "$ProjectRoot\database\schema.sql"
    if (Test-Path $SchemaFile) {
        # Execute MySQL import
        $ImportCmd = "& '$MySQLPath\bin\mysql.exe' -u root -e `"source $SchemaFile`""
        Invoke-Expression $ImportCmd
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Database schema initialized and seeded successfully!" -ForegroundColor Green
        } else {
            Write-Host "   WARNING: Database schema import returned an error." -ForegroundColor Red
        }
    } else {
        Write-Host "   ERROR: schema.sql file not found at $SchemaFile!" -ForegroundColor Red
    }
} else {
    Write-Host "   ERROR: MySQL server could not be started on port 3306!" -ForegroundColor Red
}

# 5. Deploy to Tomcat
Write-Host "[5/6] Deploying web application files to Tomcat webapps..." -ForegroundColor Yellow
if (Test-Path $DeployDir) {
    Write-Host "   Removing existing deployment directory..." -ForegroundColor DarkYellow
    Remove-Item -Path $DeployDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null

# Copy webapp assets and directories
Copy-Item -Path "src/main/webapp/*" -Destination $DeployDir -Recurse -Force

# Create standard uploads folders in the deployed path
New-Item -ItemType Directory -Path "$DeployDir/uploads/assignments" -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir/uploads/materials" -Force | Out-Null
New-Item -ItemType Directory -Path "$DeployDir/uploads/profiles" -Force | Out-Null

# Copy python scripts inside Tomcat for runtime calling context
New-Item -ItemType Directory -Path "$DeployDir/python" -Force | Out-Null
Copy-Item -Path "python/*" -Destination "$DeployDir/python" -Recurse -Force

Write-Host "   Web application deployed to $DeployDir" -ForegroundColor Green

# 6. Start Apache Tomcat
Write-Host "[6/6] Launching Tomcat Web Server..." -ForegroundColor Yellow
# Check if Tomcat port 8080 is already open
$TomcatOpen = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 8080)
    $TomcatOpen = $true
    $tcp.Close()
} catch {
    $TomcatOpen = $false
}

if (!$TomcatOpen) {
    Write-Host "   Tomcat is not running. Starting Tomcat..." -ForegroundColor DarkYellow
    Start-Process -FilePath "$TomcatPath\bin\startup.bat" -WorkingDirectory "$TomcatPath\bin"
    Write-Host "   Tomcat startup initiated." -ForegroundColor Green
} else {
    Write-Host "   Tomcat is already running. Restarting context..." -ForegroundColor DarkYellow
    # Touch context or run stop/start scripts
    Start-Process -FilePath "$TomcatPath\bin\shutdown.bat" -WorkingDirectory "$TomcatPath\bin" -NoNewWindow -Wait
    Start-Sleep -Seconds 2
    Start-Process -FilePath "$TomcatPath\bin\startup.bat" -WorkingDirectory "$TomcatPath\bin"
    Write-Host "   Tomcat restarted." -ForegroundColor Green
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Deploy completed! Open http://localhost:8080/LearnX" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
