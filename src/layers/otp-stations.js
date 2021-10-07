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


const stationQuery = `
  query stations{
    stations{
      gtfsId
      name
      lat
      lon
      locationType
      stops {
        gtfsId
        patterns {
          route {
            mode
            shortName
          }
        }
      }
    }
  }
`;

const stationMapper = data => ({
  type: "FeatureCollection",
  features: data.data.stations.map(station => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [station.lon, station.lat] },
    properties: {
      gtfsId: station.gtfsId,
      name: station.name,
      type: Array.from(new Set(station.stops.flatMap(stop => stop.patterns.flatMap(pattern => pattern.route.mode)))).join(','),
      stops: JSON.stringify(station.stops.map(stop => stop.gtfsId)),
      routes: JSON.stringify(station.stops.flatMap(stop => stop.patterns.flatMap(pattern => pattern.route)).uniq()),
    }
  }))
})


export class StationLayer {

  async init(uri) {
    const result = await axios.post(uri, stationQuery, {headers:{
      'Content-Type': 'application/graphql',
      'OTPTimeout': '60000',
      'OTPMaxResolves': '100000000'
    }});
    
    this.stationTileIndex = geojsonvt(stationMapper(result.data), {
      maxZoom: 22,
      buffer: 512,
    });

    console.log("stations loaded from:", uri);
  };


  getTile(z, x, y) {
    let stationTile = this.stationTileIndex.getTile(z, x, y)

    if (stationTile === null) {
      stationTile = { features: [] }
    }

    return stationTile;
  }

  getInfo() {
    return {
      format: "pbf",
      maxzoom: 20,
      minzoom: 0,
      vector_layers: [
      {
        description: "",
        id: "stations"
      }]
    }
  }
}
