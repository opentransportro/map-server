import geojsonvt from 'geojson-vt';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const partnerPinMapper = (pins) => ({
  type: "FeatureCollection",
  features: pins
    .filter(pin => pin.actionUrl)
    .map(pin => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
      properties: {
        gtfsId: `pin-${pin.id}`,
        name: pin.title,
        title: pin.title,
        desc: pin.description,
        code: pin.slug,
        type: pin.type,
        actionUrl: pin.actionUrl,
        imageUrl: pin.imageUrl,
      }
    }))
});

export class PartnerPinsLayer {

  async init(uri) {
    const defaultUrl = "https://partners-api.api.opentransport.ro/map-pins";
    const pinsUrl = defaultUrl;

    let pins = [];
    try {
      const result = await axios.get(pinsUrl, { headers: {
        'Accept': 'application/json',
      }});
      this.loadPins(result.data.data);
      console.log("Partner pins loaded from: ", pinsUrl);
    } catch (e) {
      console.error(`Partner pins loaded failed: ${pinsUrl}`);
      console.error(r);
      this.loadPins([]);
    }
  };

  loadPins(pins) {
    this.partnerTileIndex = geojsonvt(partnerPinMapper(pins), {
      maxZoom: 22,
      extent: 4096,
      debug: 2,
      generateId: true,
      indexMaxZoom: 4,
      buffer: 1024,
      indexMaxPoints: 100000,
      solidChildren: false,
    });
  }

  getTile(z, x, y) {
    let partnerTile = this.partnerTileIndex.getTile(z, x, y)

    if (partnerTile === null) {
      partnerTile = { features: [] }
    }

    return partnerTile;
  };

  getInfo() {
    return {
      format: "pbf",
      maxzoom: 20,
      minzoom: 0,
      vector_layers: [{
        description: "",
        id: "partners"
      }]
    };
  };
}
