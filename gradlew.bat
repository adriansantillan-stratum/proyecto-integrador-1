@REM
@REM Copyright 2011 the original author or authors.
@REM
@REM Licensed under the Apache License, Version 2.0 (the "License");
@REM you may not use this file except in compliance with the License.
@REM You may obtain a copy of the License at
@REM
@REM      http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing, software
@REM distributed under the License is distributed on an "AS IS" BASIS,
@REM WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@REM See the License for the specific language governing permissions and
@REM limitations under the License.
@REM

@IF EXIST "%~dp0java.exe" (
  SET _JAVACMD="%~dp0java.exe"
) ELSE (
  SET _JAVACMD=java.exe
)

@REM Determine the script path
@SET SCRIPT_DIR=%~dp0
@SET APP_HOME=%SCRIPT_DIR%

@REM Find the wrapper JAR
@SET WRAPPER_JAR=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

@REM Check if wrapper JAR exists
@IF NOT EXIST "%WRAPPER_JAR%" (
    @ECHO ERROR: The gradle-wrapper.jar file does not exist in %WRAPPER_JAR%.
    @ECHO Please ensure the Gradle Wrapper is correctly set up.
    @EXIT /B 1
)

@REM Execute the wrapper
"%_JAVACMD%" -jar "%WRAPPER_JAR%" %*
