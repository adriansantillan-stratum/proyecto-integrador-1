package com.ecoroute.backend.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.sqs.SqsAsyncClient;

/** Production never inherits test credentials or the localhost emulator endpoint. */
@Configuration
@Profile("prod")
public class ProductionAwsConfig {
    @Bean
    S3AsyncClient s3AsyncClient(@Value("${aws.region}") String region) {
        return S3AsyncClient.builder().region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create()).build();
    }
    @Bean
    SqsAsyncClient sqsAsyncClient(@Value("${aws.region}") String region) {
        return SqsAsyncClient.builder().region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create()).build();
    }
}
