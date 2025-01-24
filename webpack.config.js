const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        index: './src/index.ts',  // Entry point for the first HTML file
        analyze: './src/analyze.ts',      // Entry point for the second HTML file
    },
    output: {
        filename: '[name].js',  // This will generate index_2.js and index.js
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {  test: /\.json$/,
                type: 'json',
                include: path.resolve(__dirname, 'data')},
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules\/index\/index_refactor\.ts/,

            },
            {   test: /\.css$/, // Matches .css files
                use: [
                    'style-loader', // Injects styles into DOM
                    'css-loader',   // Resolves CSS imports
                ]
            }
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'template/index.html',  // HTML template for the first file
            filename: '../public/index.html',      // Output HTML file name
            chunks: ['index'],           // Inject the corresponding JS file (index_2.js)
        }),
        new HtmlWebpackPlugin({
            template: 'template/analyze.html',    // HTML template for the second file
            filename: '../public/analyze.html',        // Output HTML file name
            chunks: ['analyze'],             // Inject the corresponding JS file (index.js)
        }),
    ],
};
