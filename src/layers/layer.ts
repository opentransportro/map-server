enum LayerFormat {
  PBF = 'pbf', // mapbox vector tile format
  VT = 'vt', // vector tile format
  GEOJSON = 'geojson',
}

interface ILayerInfo {
  name?: String;
  format: LayerFormat;
  maxzoom: Number;
  minzoom: Number;
  vector_layers: Array<{
    description: String;
    id: String;
  }>
}


interface ILayerConstructor {
  new (uri: string, callback: Function): ILayer;
}

interface ILayer {
  getTile(z: Number, x: Number, y: Number): void;
  init(url: string, callback?: Function): void;
  getInfo(): void;
}

export { ILayer, ILayerConstructor, ILayerInfo, LayerFormat};