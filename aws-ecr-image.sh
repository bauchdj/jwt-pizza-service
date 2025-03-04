#!/bin/bash

set -e # Exit on error

# Load environment variables from .env file
source .env

# Validate required variables
if [[ -z "$AWS_ACCOUNT_ID" || -z "$AWS_REGION" || -z "$ECR_REPOSITORY" || -z "$IMAGE_TAG" ]]; then
    echo "Missing required environment variables!"
    exit 1
fi

# Authenticate Docker with AWS ECR
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Pull the Docker image
docker pull "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

# Run the container
docker run -d -p 80:80 --name my-container "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

echo "Container is running!"

