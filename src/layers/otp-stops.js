import geojsonvt from 'geojson-vt';
import _ from 'lodash';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

Array.prototype.flatMap = function (lambda) {
  return [].concat.apply([], this.map(lambda));
};

Array.prototype.uniq = function () {
  return _.uniqWith(this, _.isEqual)
};

const stopQuery = `
  query stops {
    stops{
      gtfsId
      name
      code
      platformCode
      lat
      lon
      locationType
      desc
      parentStation {
        gtfsId
      }
      patterns {
        headsign
        route {
          mode
          shortName
        }
      }
    }
  }
`;


const stopMapper = data => ({
  type: "FeatureCollection",
  features: data.data.stops.map(stop => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
    properties: {
      gtfsId: stop.gtfsId,
      name: stop.name,
      code: stop.code,
      platform: stop.platformCode,
      desc: stop.desc,
      parentStation: stop.parentStation == null ? null : stop.parentStation.gtfsId,
      type: stop.patterns == null ? null : stop.patterns.map(pattern => pattern.route.mode).uniq().join(","),
      patterns: stop.patterns == null ? null : JSON.stringify(stop.patterns.map(pattern => ({
        headsign: pattern.headsign,
        type: pattern.route.mode,
        shortName: pattern.route.shortName,
      })))
    }
  }))
})


export class StopsLayer  {

  async init(uri) {
    const result = await axios.post(uri, stopQuery, {headers:{
      'Content-Type': 'application/graphql',
      'OTPTimeout': '60000',
      'OTPMaxResolves': '100000000'
    }});

    this.stopTileIndex = geojsonvt(stopMapper(result.data), {
      maxZoom: 22,
      extent: 4096,
      debug: 2,
      generateId: true,
      indexMaxZoom: 4,
      buffer: 1024,
      indexMaxPoints: 100000,
      solidChildren: false,
    });
    
    console.log("stops loaded from:", uri)
  };


  getTile(z, x, y) {
    let stopTile = this.stopTileIndex.getTile(z, x, y)

    if (stopTile === null) {
      stopTile = { features: [] }
    }

    return stopTile;
  }

  getInfo() {
    return {
      format: "pbf",
      maxzoom: 20,
      minzoom: 0,
      vector_layers: [{
        description: "",
        id: "stops"
      }]
    }
  }
}
