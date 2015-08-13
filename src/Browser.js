/* 
 * Copyright 2015 Phillip Hayward <phil@pjhayward.net>.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var Node = require('famous/core/Node');
var DOMElement = require('famous/dom-renderables/DOMElement');
var Button = require('./Button');

function Browser(transitions) {
	Node.call(this);
	var element = new DOMElement(this, {id: 'fw-browser', classes: ['fw-content']});
	this.element = element;
	element.setContent('This is the game browser');

	function join() {
		transitions.joinGame('');
	}
	var joinButton = new Button('Join Game', join);
	this.addChild(joinButton)
					.setAlign(0.5, 0.5, 1)
					.setMountPoint(0.5, 0.5, 1)
					.setSizeMode(1, 1, 1)
					.setAbsoluteSize(150, 24, 1);
}

Browser.prototype = Object.create(Node.prototype);

Browser.onReceive = function (evt, payload) {
	console.log(evt);
};

module.exports = Browser;