import geojsonvt from 'geojson-vt';
import _ from 'lodash';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const query = `
  query bikerentals {
    bikeRentalStations {
      stationId
      name
      networks
      lon
      lat
    }
  }`

export class BikesLayer {


  async init(uri) {
    const result = await axios.post(uri, query, {headers:{
      'Content-Type': 'application/graphql'
    }});

    const geoJSON = {
      type: "FeatureCollection", 
      features: result.data.data.bikeRentalStations.filter(station => {
        return station.lat != 0 && station.lon != 0;
      }).map((station) => ({
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
      maxZoom: 22,
      buffer: 256
    });
    console.log("city bikes loaded from:", uri)
  }

  getTile(z, x, y) {
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null) {
      tile = { features: [] }
    }

    return tile;
  }

  getInfo() {
    return {
      format: "pbf",
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

