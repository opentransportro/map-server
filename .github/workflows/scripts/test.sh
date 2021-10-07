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

test http://localhost:8080/romania-citybike-map/13/4577/2922.pbf 37
test http://localhost:8080/romania-stop-map/13/4580/2922.pbf 37
test http://localhost:8080/romania-station-map/13/4580/2922.pbf 32