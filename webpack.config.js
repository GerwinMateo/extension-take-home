const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');

module.exports = {
  entry: {
    content: './static/js/content.js',
    sidepanel: './static/js/sidepanel.js',
    background: './static/js/background.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].js',
    clean: true
  },
  mode: 'production',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'static/html/sidepanel.html', to: 'html/sidepanel.html' },
        { from: 'static/css/sidepanel.css', to: 'css/sidepanel.css' }
      ]
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('ManifestPlugin', () => {
          // Read the original manifest
          const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
          
          // Update paths for the built extension
          manifest.side_panel.default_path = 'html/sidepanel.html';
          manifest.content_scripts[0].js = ['js/content.js'];
          manifest.background.service_worker = 'js/background.js';
          
          // Write the updated manifest to dist
          fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
        });
      }
    }
  ],
  optimization: {
    minimize: false // Keep readable for debugging
  }
}; 