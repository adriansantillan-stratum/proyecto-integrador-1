# Stage 1: Build with Gradle
FROM gradle:8.5-jdk17-jammy AS build
WORKDIR /app
COPY --chown=gradle:gradle . .
RUN gradle build -x test --no-daemon

# Stage 2: Run the application (Using Eclipse Temurin for better stability)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8081
USER 10001:10001
ENTRYPOINT ["java", "-jar", "app.jar"]
