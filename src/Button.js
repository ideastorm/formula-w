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

function Button(content, callback) {
	this.node = Node.call(this);
	this.element = new DOMElement(this, {classes: ['fw-button'], content: content});
	if (typeof callback === 'function') {
		this.callback = callback;
		this.addUIEvent('click');
	}
//	this.onReceive = function onReceive(event, payload) {
//		console.log('got stuff');
//		if (event === 'click' && typeof payload.node.callback === 'function')
//			payload.node.callback();
//	};
	
}

Button.prototype = Object.create(Node.prototype);

module.exports = Button;