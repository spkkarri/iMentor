const path = require('path');

module.exports = {
  devServer: {
    allowedHosts: 'all',
    port: 4004,
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws'
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  },
  webpack: {
    configure: (webpackConfig) => {
      // Fix for webpack dev server
      if (webpackConfig.devServer) {
        webpackConfig.devServer.allowedHosts = 'all';
      }

      // Fix for babel-loader and html-webpack-plugin resolution
      webpackConfig.resolveLoader = {
        ...webpackConfig.resolveLoader,
        modules: [
          path.resolve(__dirname, 'node_modules'),
          'node_modules'
        ]
      };

      // Add alias for easier imports
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        alias: {
          ...webpackConfig.resolve.alias,
          '@': path.resolve(__dirname, 'src')
        }
      };

      return webpackConfig;
    }
  }
};
