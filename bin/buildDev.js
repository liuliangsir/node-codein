/* eslint import/no-extraneous-dependencies: 0 */
import fs from 'fs';
import path from 'path';
import cp from 'child_process';

import rimraf from 'rimraf';
import mkpath from 'mkpath';
import webpack from 'webpack';

import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import HTMLWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const CLIENT = path.join(DIST, 'client');
const CACHE = path.join(ROOT, '.cache');

rimraf.sync(path.join(DIST, '*'));
mkpath(CLIENT);
mkpath(CACHE);

const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json')));

const babelConfig = JSON.stringify({
  ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.babelrc'), 'utf-8')),
  cacheDirectory: CACHE,
});

const commonConfig = {
  module: {
    loaders: [
      { test: /\.(js|jsx)$/i, exclude: /node_modules/i, loader: `babel-loader?${babelConfig}` },
      { test: /\.json$/i, loader: 'json-loader' },
    ],
  },
  plugins: [
    new ProgressBarPlugin(),
  ],
};

/**
 * Client
 */
webpack({
  ...commonConfig,
  target: 'web',
  context: path.join(SRC, 'client'),
  entry: {
    client: path.join(SRC, 'client', 'index.js'),
  },
  output: {
    path: CLIENT,
    filename: '[name].js',
  },
  plugins: [
    ...commonConfig.plugins,
    new HTMLWebpackPlugin({
      defaultTitle: appConfig.name,
      template: path.join(SRC, 'client', 'index.html'),
      filename: path.join(CLIENT, 'index.html'),
      favicon: path.join(SRC, 'client', 'images', 'favicon.ico'),
      inject: false,
    }),

    new CopyWebpackPlugin([{
      from: path.join(SRC, 'client', '**'),
      to: path.join(CLIENT),
    }]),
  ],
}).watch({ }, () => {
  //
});

/**
 * Server
 */
let serverInstance;
const serverCompiler = webpack({
  ...commonConfig,
  target: 'node',
  context: path.join(SRC, 'server'),
  entry: {
    server: path.join(SRC, 'server', 'index.js'),
  },
  output: {
    path: DIST,
    filename: '[name].js',
  },
});

serverCompiler.plugin('after-emit', (compilation, callback) => {
  function restart() {
    serverInstance = cp.fork(path.join(DIST, 'server.js'), { cwd: DIST });
    serverInstance.on('close', () => { serverInstance = undefined; });
    callback();
  }
  if (serverInstance) {
    serverInstance.on('close', restart);
    serverInstance.kill();
  } else {
    restart();
  }
});

serverCompiler.watch({ }, () => { });