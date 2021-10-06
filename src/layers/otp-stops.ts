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

const stopQuery: String = `
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

export class StopsLayer implements ILayer {
  stopTileIndex: any;

  init(uri: string, callback?: Function) {
    getTileIndex(uri, stopQuery, stopMapper, (err: any, stopTileIndex: any) => {
      if (err) {
        callback(err);
        return;
      }
      this.stopTileIndex = stopTileIndex;
      console.log("stops loaded from:", uri)
      callback(null, this);
    })
  };


  getTile(z: Number, x: Number, y: Number) {
    let stopTile = this.stopTileIndex.getTile(z, x, y)

    if (stopTile === null) {
      stopTile = { features: [] }
    }

    return stopTile;
  }

  getInfo(): ILayerInfo {
    return {
      format: LayerFormat.PBF,
      maxzoom: 20,
      minzoom: 0,
      vector_layers: [{
        description: "",
        id: "stops"
      }]
    }
  }
}
