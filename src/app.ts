import express, { Request, Response } from "express";
import * as vtpbf from "vt-pbf";
import cors from "cors";
import * as zlib from "zlib";
import { BikesLayer } from "./layers/otp-bikes";
import { StopsLayer } from "./layers/otp-stops";
import { ILayer } from "./layers/layer";
import { IVectorTile, toFeatureCollection } from "./utils";
import { StationLayer } from "./layers/otp-stations";

// "https://api.opentransport.ro/routing/v1/routers/romania/index/graphql"

/** GeojsonVT extent option */
const extent = 4096;

const emptyResponse = { tile: undefined, x: 0, y: 0, z: 0 };

console.log("Starting service...");

const startService = async () => {
  const registeredLayers: Array<{
    name: string;
    layer: ILayer;
  }> = [];

  const registerLayer = (name: string, layer: ILayer) => {
    console.log(`Registering layer ${name}`);
    registeredLayers.push({ name, layer });
  }

  registerLayer("romania-citybike-map", new BikesLayer());
  registerLayer("romania-stop-map", new StopsLayer());
  registerLayer("romania-station-map", new StationLayer());


  const app = express();
  app.use(cors());
  const httpPort = process.env.PORT || 8080; // default port to listen
  app.use(express.static(process.env.PUBLIC_FOLDER || "public"));

  const extensions = [
    "geojson",
    'pbf (for MapBox GL, use source-layer: "all")',
    "vt",
  ];

  const ulList = (l: string) =>
    "<ul>" +
    extensions.map((ext) => `<li>${l}/{z}/{x}/{y}.${ext}</li>`).join("\n") +
    "</ul>";

  const tileIndexes: { [key: string]: ILayer } = {};

  registeredLayers.forEach((registeredLayer) => {
    const { name, layer } = registeredLayer;
    tileIndexes[name] = layer;
    layer.init(process.env.OTP_URL || "https://api.opentransport.ro/routing/v1/routers/romania/index/graphql", () => { });
  })

  const send404 = (res: Response) => {
    const availableLayers = Object.keys(tileIndexes);
    const list = availableLayers
      .sort()
      .map((l) => `<ol><li>${ulList(l)}</li></ol>`)
      .join("\n");
    res.status(404).send(
      `<h1>Layer not found</h1>
      <p>Available layers are:
      ${list}
      </p>`
    );
  };


  const getTile = (req: Request, res: Response) => {
    const layer = req.params.layer;
    if (!tileIndexes.hasOwnProperty(layer)) {
      send404(res);
      return emptyResponse;
    }
    const z = +req.params.z;
    const x = +req.params.x;
    const y = +req.params.y;
    const tile = tileIndexes[layer].getTile(z, x, y);
    return { tile, x, y, z };
  };


  app.get("/", (_, res) => send404(res));

  app.get("/:layer/:z/:x/:y.geojson", (req, res) => {
    const { tile, x = 0, y = 0, z = 0 } = getTile(req, res);
    if (!tile || !tile.features) {
      res.json({});
      return;
    }
    const vectorTiles = tile.features as IVectorTile[];
    res.json(toFeatureCollection(vectorTiles, x, y, z, extent));
  });

  app.get("/:layer/:z/:x/:y.vt", (req, res) => {
    const { tile } = getTile(req, res);
    if (!tile || !tile.features) {
      return;
    }
    const vectorTiles = tile.features as IVectorTile[];
    res.json(vectorTiles);
  });

  app.get("/:layer/:z/:x/:y.pbf", (req, res) => {
    const { tile } = getTile(req, res);
    if (!tile || !tile.features) {
      return;
    }
    const data = Buffer.from(vtpbf.fromGeojsonVt({ stations: tile }));
    res.setHeader("Content-Type", "application/x-protobuf");
    res.setHeader("Content-Encoding", "gzip");

    /** Notice that I set the source-layer (for Mapbox GL) to all */
    res.send(zlib.gzipSync(data, { level: 9 }));
  });

  // start the Express server
  app.listen(httpPort, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${httpPort}`);
  });
};


startService();