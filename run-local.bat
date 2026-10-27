@echo off
echo =================================================================
echo  Starting EcoRoute Backend Application (Local Profile)
echo =================================================================
echo.
echo [INFO] This will run the application using the 'local' Spring profile.
echo [INFO] Make sure your local PostgreSQL database 'ecoroute' is running.
echo.

REM Run the Spring Boot application using the Gradle wrapper
call .\gradlew.bat bootRun --args="--spring.profiles.active=local"

echo.
echo [INFO] Application has been shut down.
pause
