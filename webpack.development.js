var path         = require('path'),
    webpack      = require('webpack');

module.exports = {
  devtool: 'eval',
  entry: [
    'webpack-dev-server/client?http://localhost:8081',
    'webpack/hot/only-dev-server',
    './src/js/main.jsx'
  ],
  output: {
    path: '/',
    filename: 'app.js',
    publicPath: '/js/',
    vendor: ['react',
             'material-ui',
             'react-router',
             'lodash',
             'velocity-animate',
             'bluebird']
  },
  module: {
    loaders: [{
      test: /\.jsx$/,
      loaders: ['react-hot', 'babel?stage=0'],
      include: path.join(__dirname, 'src')
    }]
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.optimize.CommonsChunkPlugin(
      'vendor',
      'libs.js'
    )
  ],
  resolve: {
    extensions: ['', '.js', '.jsx']
  }
};