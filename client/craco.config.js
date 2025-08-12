module.exports = {
  devServer: {
    allowedHosts: 'all',
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
      return webpackConfig;
    }
  }
};
