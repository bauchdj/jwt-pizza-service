#!/bin/bash

set -e # Exit on error

DOCKER_DIR=docker-dist
SERVICE_NAME=jwt-pizza-service
PORT=80

# Build JavaScript
npm run build
echo ""

# Copy the files to the docker directory
rm -rf $DOCKER_DIR
mkdir $DOCKER_DIR
cp Dockerfile $DOCKER_DIR
cp -r dist/src/* $DOCKER_DIR
cp dist/version.json $DOCKER_DIR
cp package.json $DOCKER_DIR
cp package-lock.json $DOCKER_DIR

# Change package.json type to commonjs
jq '.type="commonjs"' package.json > "$DOCKER_DIR/package.json"

# Update src/config.js to use host.docker.internal
sed -i.bak 's/host: "127.0.0.1"/host: "host.docker.internal"/' "$DOCKER_DIR/config.js"
rm "$DOCKER_DIR/config.js.bak"

cd $DOCKER_DIR
ls
echo ""

# Build the docker image
docker build -t $SERVICE_NAME .
docker images -a
echo ""

# Run the container
docker run -d --name $SERVICE_NAME -p $PORT:$PORT $SERVICE_NAME

# Wait for the service to be available by checking logs
echo "Waiting for service to start..."
echo ""
SLEEP_TIME=0.5
LOG_MESSAGE="Server started"
SLEEP_TIME=1
TOTAL_SLEEP_TIME=0
TIMEOUT=5  # Timeout in seconds

echo "Waiting for '$LOG_MESSAGE' in logs of $SERVICE_NAME..."

while ! docker logs "$SERVICE_NAME" 2>&1 | grep -q "$LOG_MESSAGE"; do
  sleep $SLEEP_TIME
  TOTAL_SLEEP_TIME=$((TOTAL_SLEEP_TIME + SLEEP_TIME))

  if [ $TOTAL_SLEEP_TIME -ge $TIMEOUT ]; then
    echo "Server did not start within the timeout period."
    docker logs "$SERVICE_NAME"
    docker rm -fv "$SERVICE_NAME"
    exit 1
  fi
done

echo "'$LOG_MESSAGE' detected in logs of $SERVICE_NAME!"


# sleep 2
# docker logs $SERVICE_NAME 2>&1 | grep "Server started"
echo "Server started successfully!"
echo ""

# Test the service
if curl -s --fail http://localhost:$PORT; then
  echo "Service is up and responding"
else
  echo "Service test failed"
  docker logs $SERVICE_NAME
  docker rm -fv $SERVICE_NAME
  exit 1
fi

# Cleanup
docker rm -fv $SERVICE_NAME
docker rmi $SERVICE_NAME
echo "Removed docker container and image"

rm -rf docker-dist
echo "Removed docker-dist"
