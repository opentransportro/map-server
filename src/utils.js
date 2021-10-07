import * as fs from 'fs';
import * as path from 'path';
import * as geojsonvt from 'geojson-vt';

const GeometryType = {
  Unknown: 0, Point: 1, LineString: 2, Polygon: 3
};



/**
 * Load a GeoJSON file
 *
 * @param {string} file
 * @returns
 */
export const loadGeoJSON = (file) => {
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
export const findGeojsonFilesInFolder = (folder) => {
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
export const createTileIndex = async (filename, options) => {
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
      },
      options
    )
  );
};


export const toFeatureCollection = (features, x, y, z, extent = 4096) => {
  return {
    type: 'FeatureCollection',
    features: features.map(f => toGeoJSON(f, x, y, z, extent))
  };
};

const toGeoJSON = (feature, x, y, z, extent) => {
  const size = extent * Math.pow(2, z);
  const x0 = extent * x;
  const y0 = extent * y;
  var projectedCoordinates = [];
  var coords = feature.geometry;
  var type = [feature.type];

  const project = (line) => {
    const projected = [];
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
      type = 'Point';
      projectedCoordinates = project(coords);
      break;

    case GeometryType.LineString:
      type = 'LineString';
      for (let i = 0; i < coords.length; i++) {
        projectedCoordinates[i] = project(coords[i]);
      }
      break;

    case GeometryType.Polygon:
      type = 'Polygon';
      coords = classifyRings(coords);
      for (let i = 0; i < coords.length; i++) {
        projectedCoordinates[i] = [];
        for (let j = 0; j < coords[i].length; j++) {
          projectedCoordinates[i][j] = project(coords[i][j]);
        }
      }
      break;
  }

  if (projectedCoordinates.length === 1) {
    projectedCoordinates = projectedCoordinates[0];
  } else {
    type = 'Multi' + type;
  }

  const result = {
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

const classifyRings = (rings) => {
  const len = rings.length;

  if (len <= 1) return [rings];

  const polygons = [];
  let polygon = [];
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

const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2[0] - p1[0]) * (p1[1] + p2[1]);
  }
  return sum;
};