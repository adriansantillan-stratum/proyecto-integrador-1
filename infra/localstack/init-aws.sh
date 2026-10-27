#!/bin/bash
set -euo pipefail
awslocal s3api head-bucket --bucket ecoroute-proofs >/dev/null 2>&1 || awslocal s3 mb s3://ecoroute-proofs
awslocal s3api put-bucket-versioning --bucket ecoroute-proofs --versioning-configuration Status=Enabled
awslocal sqs create-queue --queue-name ecoroute-notifications-dlq >/dev/null
awslocal sqs create-queue --queue-name ecoroute-notifications >/dev/null
QUEUE_URL=$(awslocal sqs get-queue-url --queue-name ecoroute-notifications --query QueueUrl --output text)
DLQ_URL=$(awslocal sqs get-queue-url --queue-name ecoroute-notifications-dlq --query QueueUrl --output text)
DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
awslocal sqs set-queue-attributes --cli-input-json "{\"QueueUrl\":\"${QUEUE_URL}\",\"Attributes\":{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}}"
echo "EcoRoute S3 and SQS ready; existing data preserved"
