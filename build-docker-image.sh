#!/bin/bash

set -e # Exit on error

# JWT_SECRET, MYSQL_DB, FACTORY_API_KEY
# DB_USERNAME, DB_PASSWORD, DB_HOSTNAME
source .env

DOCKER_DIR=docker-dist
SERVICE_NAME=jwt-pizza-service
PORT=80

# Build JavaScript
npm run build
echo ""

rm -rf $DOCKER_DIR
mkdir $DOCKER_DIR

# Copy the files to the docker directory 
cp Dockerfile $DOCKER_DIR
cp -r dist/src/* $DOCKER_DIR
cp dist/version.json $DOCKER_DIR
cp package.json $DOCKER_DIR
cp package-lock.json $DOCKER_DIR

# Override dbConfig.json to replicate GitHub action steps
cat > $DOCKER_DIR/dbConfig.json <<EOF
{
  "jwtSecret": "$JWT_SECRET",
  "db": {
    "connection": {
      "host": "127.0.0.1",
      "user": "root",
      "password": "tempdbpassword",
      "database": "$MYSQL_DB",
      "connectTimeout": 60000
    },
    "listPerPage": 10
  },
  "factory": {
    "url": "https://pizza-factory.cs329.click",
    "apiKey": "$FACTORY_API_KEY"
  }
}
EOF

# Change package.json type to commonjs in DOCKER_DIR directory
jq '.type="commonjs"' $DOCKER_DIR/package.json > $DOCKER_DIR/package.json.tmp && mv $DOCKER_DIR/package.json.tmp $DOCKER_DIR/package.json

# Update dbConfig.json with new values
jq --arg host "$DB_HOSTNAME" --arg user "$DB_USERNAME" --arg password "$DB_PASSWORD" \
   '.db.connection.host = $host | .db.connection.user = $user | .db.connection.password = $password' \
   $DOCKER_DIR/dbConfig.json > $DOCKER_DIR/dbConfig.json.tmp && mv $DOCKER_DIR/dbConfig.json.tmp $DOCKER_DIR/dbConfig.json

# Build the docker image
cd $DOCKER_DIR
docker build -t $SERVICE_NAME .
cd ..
docker images -a
echo "Built docker image $SERVICE_NAME"

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
  echo ""
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

rm -rf $DOCKER_DIR
echo "Removed $DOCKER_DIR"
