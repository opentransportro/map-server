const webpack = require("webpack");
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NodemonPlugin = require('nodemon-webpack-plugin');
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv !== "development";

// Common plugins
let plugins = [
  new webpack.DefinePlugin({
    "process.env": { NODE_ENV: JSON.stringify(nodeEnv) },
  }),
  new NodemonPlugin({
    // Files to ignore.
    ignore: ['*.js.map'],
    // Extensions to watch.
    ext: 'js',
  }), // 
];

if (!isProduction) {
  plugins.push(new webpack.HotModuleReplacementPlugin());
  
}

module.exports = {
  mode: nodeEnv,
  devtool: "source-map",
  entry: "./src/app.js",
  externals: [nodeExternals()],
  externalsPresets: { node: true },
  plugins: plugins,
  target: "node",
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "app.js",
  },
  resolve: {
    extensions: [".js"],
    modules: [path.resolve(__dirname, "node_modules")],
  },
};
