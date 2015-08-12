'use strict';

var FamousEngine = require('famous/core/FamousEngine');
var Mesh = require('famous/webgl-renderables/Mesh');
var Color = require('famous/utilities/Color');
var Camera = require('famous/components/Camera');
var PointLight = require('famous/webgl-renderables/lights/PointLight');
var OBJLoader = require('famous/webgl-geometries/OBJLoader');
var Geometry = require('famous/webgl-geometries/Geometry');

var scene = FamousEngine.createScene('body');

FamousEngine.init();

var camera = new Camera(scene)
				.setDepth(1000);

var meshNode = scene.addChild()
				.setOrigin(0.5, 0.5, 0.5)
				.setAlign(0.5, 0.5, 0.5)
				.setMountPoint(0.5, 0.5, 0.5)
				.setSizeMode(1, 1, 1)
				.setAbsoluteSize(200, 200, 200);

OBJLoader.load("models/bishopAbstractChessSet.obj", function (geometries) {
	console.log(geometries);
	for (var i = 0; i < geometries.length; i++) {
		var buffers = geometries[i];
		console.log(buffers);

		var geometry = new Geometry({
			buffers: [
				{name: 'a_pos', data: buffers.vertices, size: 3},
//				{name: 'a_normals', data: buffers.normals, size: 3},
//				{name: 'a_texCoords', data: buffers.textureCoords, size: 2},
				{name: 'indices', data: buffers.indices, size: 3}
			]
		});

		var pieceNode = meshNode.addChild();
		var mesh = new Mesh(pieceNode)
						.setGeometry(geometry);
	}
});

var lightNode = scene.addChild()
				.setAlign(0.5, 0.5, 0.5)
				.setPosition(0, 0, 250);

var light = new PointLight(lightNode)
				.setColor(new Color('white'));

var lightNode1 = scene.addChild()
				.setAlign(0.5, 0.5, 0.5)
				.setPosition(0, 250);

var light1 = new PointLight(lightNode1)
				.setColor(new Color('red'));


var clock = FamousEngine.getClock();

FamousEngine.getClock().setInterval(function () {
	var time = clock.getTime();

	lightNode.setPosition(0, Math.sin(time / 1200) * 250, Math.cos(time / 1200) * 250);
	lightNode1.setPosition(Math.sin(time / 1500) * 250, Math.cos(time / 1200) * 250, 0);

	meshNode.setRotation(
					time / 1500,
					time / 1200,
					time / 1300
					);

}, 16);
