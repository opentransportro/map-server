#!/bin/bash
set -e

# Set these environment variables
#DOCKER_USER // dockerhub credentials
#DOCKER_AUTH

COMMIT_HASH=$(git rev-parse --short "$GITHUB_SHA")
DOCKER_TAG_LONG=$DOCKER_TAG-$(date +"%Y-%m-%dT%H.%M.%S")-$COMMIT_HASH

DOCKER_IMAGE=map-server:$DOCKER_TAG
DOCKER_IMAGE_TAG=otrro/map-server:$DOCKER_TAG
DOCKER_IMAGE_TAG_LONG=otrro/map-server:$DOCKER_TAG_LONG

function test {
  URL=$1
  MINLENGTH=$2

  echo $URL - Testing

  HEADERS=$(curl -sI $URL)

  if [ -z "$HEADERS" ] ; then
    echo $URL - No response
    exit 1
  fi

  STATUS=$(head -1 <<< "$HEADERS")
  if ! grep -q "200 OK" <<< "$HEADERS" ; then
    echo $URL - Unexpected status code: $STATUS
    exit 1
  fi

  LENGTH=$(grep -i content-length <<< "$HEADERS" | awk '{print $2}' | tr -d '\r')
  if [ "$LENGTH" -lt "$MINLENGTH" ] ; then
    echo $URL - Content length too small: $LENGTH
    exit 1
  fi

  echo $URL - OK
}

echo Building $DOCKER_IMAGE
docker build --tag=$DOCKER_IMAGE -f Dockerfile .

echo Running $DOCKER_IMAGE
docker run --rm -p 8080:8080 -h map-server --name map-server $DOCKER_IMAGE &
sleep 30

test http://localhost:8080/romania-citybike-map/13/4577/2922.pbf 37
test http://localhost:8080/romania-stop-map/13/4580/2922.pbf 37
test http://localhost:8080/romania-station-map/13/4580/2922.pbf 32

echo Stopping $DOCKER_IMAGE
docker stop map-server

docker login -u $DOCKER_USER -p $DOCKER_AUTH
docker tag $DOCKER_IMAGE $DOCKER_IMAGE_TAG_LONG
docker push $DOCKER_IMAGE_TAG_LONG
docker tag $DOCKER_IMAGE $DOCKER_IMAGE_TAG
docker push $DOCKER_IMAGE_TAG
echo Pushed $DOCKER_IMAGE_TAG

echo Build completed