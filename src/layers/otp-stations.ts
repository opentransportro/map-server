import geojsonvt from 'geojson-vt';
import { post } from "requestretry";
import _ from 'lodash';
import { ILayer, ILayerInfo, LayerFormat } from './layer';

declare global {
  interface Array<T> {
    uniq(): Array<T>;
  }
}

Array.prototype.flatMap = function (lambda) {
  return [].concat.apply([], this.map(lambda));
};

Array.prototype.uniq = function () {
  return _.uniqWith(this, _.isEqual)
};


const stationQuery: String = `
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

const getTileIndex = (url, query, mapper, callback) => {
  post({
    url: url,
    body: query,
    maxAttempts: 120,
    retryDelay: 30000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/graphql',
      'OTPTimeout': '60000',
      'OTPMaxResolves': '100000000'
    }
  }, function (err, res, body) {
    if (err) {
      console.log(err)
      callback(err);
      return;
    }
    callback(null, geojsonvt(mapper(JSON.parse(body)), {
      maxZoom: 20,
      buffer: 1024,
    }));
  })
}

export class StationLayer implements ILayer {
  stationTileIndex: any

  init(uri: string, callback?: Function) {
    getTileIndex(uri, stationQuery, stationMapper, (err: any, stationTileIndex: any) => {
      if (err) {
        callback(err);
        return;
      }
      this.stationTileIndex = stationTileIndex;
      console.log("stations loaded from:", uri)
      callback(null, this);
    })
  };


  getTile(z: Number, x: Number, y: Number) {
    let stationTile = this.stationTileIndex.getTile(z, x, y)

    if (stationTile === null) {
      stationTile = { features: [] }
    }

    return stationTile;
  }

  getInfo(): ILayerInfo {
    return {
      format: LayerFormat.PBF,
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
