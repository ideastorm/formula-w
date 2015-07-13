var express = require('express');
var app = express();

app.use(express.static('public'));

require('./routes/browser.js').registerRoutes(app);
require('./routes/game.js').registerRoutes(app);

app.get('/', function (req, res) {
	res.sendFile(__dirname + 'public/index.html');
});


var server = app.listen(3000, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at http://%s:%s', host, port);
});
