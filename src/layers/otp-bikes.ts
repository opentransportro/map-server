import geojsonvt from 'geojson-vt';
import * as vtpbf from "vt-pbf";
import * as zlib from "zlib";
import request from "requestretry";
import _ from 'lodash';
import { ILayer, ILayerInfo, LayerFormat } from './layer';



const query: String = `
  query bikerentals {
    bikeRentalStations {
      stationId
      name
      networks
      lon
      lat
    }
  }`

export class BikesLayer implements ILayer {
  tileIndex: any = undefined;


  init(uri, callback: Function) {
    const options = {
      url: uri,
      body: query,
      maxAttempts: 120,
      retryDelay: 30000,
      method: "POST",
      headers: {
        'Content-Type': 'application/graphql'
      }
    };

    request.post(options, function (err: any, _res: any, body: string) {
      if (err) {
        console.log(err)
        callback(err);
        return;
      }

      const geoJSON = {
        type: "FeatureCollection", 
        features: JSON.parse(body).data.bikeRentalStations.filter(station => {
          return station.lat != 0 && station.lon != 0;
        }).map((station: { lon: any; lat: any; stationId: any; name: any; networks: any[]; }) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [station.lon, station.lat] },
          properties: {
            id: station.stationId,
            name: station.name,
            networks: station.networks.join()
          }
        }))
      }

      this.tileIndex = geojsonvt(geoJSON, {
        maxZoom: 20,
        buffer: 1024
      });
      console.log("city bikes loaded from:", uri)
      callback(null, this)
    }.bind(this));
  }

  getTile(z: Number, x: Number, y: Number) {
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null) {
      tile = { features: [] }
    }

    return tile;
  }

  getInfo(): ILayerInfo {
    return {
      format: LayerFormat.PBF,
      vector_layers: [{
        description: "",
        id: "stations"
      }],
      maxzoom: 20,
      minzoom: 1,
      name: "OTP Citybikes"
    }
  }
}

