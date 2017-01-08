var fs = require('fs');

var html = fs.readFileSync('_index.html', 'utf8');
var style = fs.readFileSync('style.css', 'utf8');
var script = fs.readFileSync('index.js', 'utf8');

html = html.replace('<style></style>', `<style>${style}</style>`);
html = html.replace('<script></script>', `<script>${script}</script>`);

fs.writeFileSync('index.html', html, { encoding: 'utf8' });
