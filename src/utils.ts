import * as fs from 'fs';
import * as path from 'path';
import * as geojsonvt from 'geojson-vt';
import { GeometryObject, GeoJsonProperties, Feature, LineString, Polygon, Point, FeatureCollection } from 'geojson';


enum GeometryType {
  Unknown = 0, Point = 1, LineString = 2, Polygon = 3
};

export interface IVectorTile {
  geometry: number[][] | number[][][] | number[][][][];
  type: number;
  tags: { [key: string]: string | number };
}


export interface IGeojsonVTOptions {
  /** max zoom to preserve detail on; can't be higher than 24 */
  maxZoom?: number;
  /** simplification tolerance (higher means simpler) */
  tolerance?: number;
  /** tile extent (both width and height) - this needs to match the value that is used in vt2geojson.ts */
  extent?: number;
  /** tile buffer on each side */
  buffer?: number;
  /** logging level (0 to disable, 1 or 2) */
  debug?: 0 | 1 | 2;
  /** whether to enable line metrics tracking for LineString/MultiLineString features */
  lineMetrics?: false;
  /** name of a feature property to promote to feature.id. Cannot be used with `generateId` */
  promoteId?: string;
  /** whether to generate feature ids. Cannot be used with `promoteId` */
  generateId?: boolean;
  /** max zoom in the initial tile index?: if indexMaxZoom === maxZoom, and indexMaxPoints === 0, pre-generate all tiles */
  indexMaxZoom?: number;
  /** max number of points per tile in the index */
  indexMaxPoints?: number;
  /** whether to include solid tile children in the index */
  solidChildren?: boolean;
}

/**
 * Load a GeoJSON file
 *
 * @param {string} file
 * @returns
 */
export const loadGeoJSON = (file: string) => {
  return new Promise<JSON>((resolve, reject) => {
    fs.readFile(file, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
};

/**
 * Get all GeoJSON files in a folder
 *
 * @param {string} folder
 * @returns
 */
export const findGeojsonFilesInFolder = (folder: string) => {
  return fs
    .readdirSync(folder)
    .map(f => path.join(folder, f))
    .filter(f => {
      const ext = path.extname(f);
      return ext && (ext.toLowerCase() === '.geojson' || ext.toLowerCase() === '.json');
    });
};

/**
 * Create a tile index using geojson-vt
 *
 * @param {string} filename
 * @returns
 */
export const createTileIndex = async (filename: string, options?: IGeojsonVTOptions) => {
  const geoJSON = await loadGeoJSON(filename);
  return geojsonvt(
    geoJSON,
    Object.assign(
      {
        maxZoom: 22,
        tolerance: 3,
        extent: 4096,
        buffer: 64,
        debug: 0,
        generateId: true,
        indexMaxZoom: 4,
        indexMaxPoints: 100000,
        solidChildren: false,
      } as IGeojsonVTOptions,
      options
    )
  );
};


export const toFeatureCollection = (features: IVectorTile[], x: number, y: number, z: number, extent = 4096): FeatureCollection<GeometryObject, GeoJsonProperties> => {
  return {
    type: 'FeatureCollection',
    features: features.map(f => toGeoJSON(f, x, y, z, extent))
  };
};

const toGeoJSON = (feature: IVectorTile, x: number, y: number, z: number, extent: number) => {
  const size = extent * Math.pow(2, z);
  const x0 = extent * x;
  const y0 = extent * y;
  let projectedCoordinates: number[][] | number[][][] | number[][][][] = [];
  let coords = feature.geometry;
  let type = GeometryType[feature.type as GeometryType];
  // let type = feature.type;
  // let i, j;

  const project = (line: number[][]) => {
    const projected: number[][] = [];
    for (let j = 0; j < line.length; j++) {
      const p = line[j];
      const y2 = 180 - (p[1] + y0) * 360 / size;
      projected[j] = [
        (p[0] + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
      ];
    }
    return projected;
  };

  switch (feature.type) {
    case GeometryType.Point:
      projectedCoordinates = project(coords as number[][]);
      break;

    case GeometryType.LineString:
      type = 'LineString';
      for (let i = 0; i < coords.length; i++) {
        projectedCoordinates[i] = project(coords[i] as number[][]);
      }
      break;

    case GeometryType.Polygon:
      type = 'Polygon';
      coords = classifyRings(coords as number[][][]);
      for (let i = 0; i < coords.length; i++) {
        projectedCoordinates[i] = [];
        for (let j = 0; j < coords[i].length; j++) {
          projectedCoordinates[i][j] = project(coords[i][j] as number[][]);
        }
      }
      break;
  }

  if (projectedCoordinates.length === 1) {
    projectedCoordinates = projectedCoordinates[0] as number[][];
  } else {
    type = 'Multi' + type;
  }

  const result: Feature<any> = {
    type: 'Feature',
    geometry: {
      type: type,
      coordinates: projectedCoordinates
    },
    properties: feature.tags
  };

  return result;
};

// classifies an array of rings into polygons with outer rings and holes

const classifyRings = (rings: number[][][]) => {
  const len = rings.length;

  if (len <= 1) return [rings];

  const polygons = [];
  let polygon: number[][][] = [];
  let ccw;

  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;

    if (ccw === undefined) ccw = area < 0;

    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);

  return polygons;
};

const signedArea = (ring: number[][]) => {
  let sum = 0;
  for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2[0] - p1[0]) * (p1[1] + p2[1]);
  }
  return sum;
};