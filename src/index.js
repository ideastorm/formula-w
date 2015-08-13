'use strict';

var FamousEngine = require('famous/core/FamousEngine');
var Node = require('famous/core/Node');
var Header = require('./Header');
var Browser = require('./Browser');
var Runtime = require('./Runtime');
var WaitingRoom = require('./WaitingRoom');

FamousEngine.init();


function App() {
	Node.call(this);

	var headerHeight = 30;

	var transitions = {
		joinGame: function joinGame(gameName) {
			alert('joining game ' + gameName);
		},
		leaveGame: function leaveGame() {
			alert('leaving game');
		}
	};

	new Header(this.addChild()
					.setSizeMode('relative', 'absolute', 'absolute')
					.setAbsoluteSize(1, headerHeight, 1)
					.setProportionalSize(1, 1, 1));

	this.addChild()
					.setSizeMode('relative', 'relative', 'relative')
					.setProportionalSize(1, 1, 1)
					.setDifferentialSize(0, -headerHeight, 0)
					.setPosition(0, headerHeight, 0).addChild(new Browser(transitions));

	new Runtime(this.addChild()
					.setSizeMode('relative', 'relative', 'relative')
					.setProportionalSize(1, 1, 1)
					.setDifferentialSize(0, -headerHeight, 0)
					.setAlign(-1, 0, 0)
					.setPosition(0, headerHeight, 0), transitions);

	new WaitingRoom(this.addChild()
					.setSizeMode('relative', 'relative', 'relative')
					.setProportionalSize(1, 1, 1)
					.setDifferentialSize(0, -headerHeight, 0)
					.setAlign(-1, 0, 0)
					.setPosition(0, headerHeight, 0), transitions);
}

App.prototype = Object.create(Node.prototype);

App.prototype.onReceive = function (event, payload) {
	console.log(event);
};

App.prototype.onMount = function (path) {
	console.log("app mounted at " + path);
};

FamousEngine.createScene('body').addChild(new App());
