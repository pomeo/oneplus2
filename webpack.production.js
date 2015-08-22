var path         = require('path'),
    webpack      = require('webpack'),
    AssetsPlugin = require('assets-webpack-plugin');

module.exports = {
  entry: [
    'webpack-dev-server/client?http://localhost:8081',
    'webpack/hot/only-dev-server',
    './src/js/main.jsx'
  ],
  output: {
    path: path.join(__dirname, 'public/js'),
    filename: 'app.[chunkhash].js',
    publicPath: '/js/',
    vendor: ['react',
             'react-router',
             'lodash',
             'velocity-animate',
             'bluebird']
  },
  resolveLoader: {
    root: path.join(__dirname, 'node_modules')
  },
  module: {
    loaders: [{
      test: /\.jsx$/,
      loader: 'babel?stage=0',
      include: path.join(__dirname, 'src/js')
    }]
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.optimize.CommonsChunkPlugin(
      'vendor',
      'libs.[hash].js'
    ),
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        warnings: false
      },
      output: {
        comments: false
      }
    }),
    new webpack.optimize.DedupePlugin(),
    new AssetsPlugin({
      path: path.join(__dirname, 'routes'),
      filename: 'assets.json'
    })
  ],
  resolve: {
    extensions: ['', '.js', '.jsx']
  }
};