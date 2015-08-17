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

'use strict'

angular.module("FormulaW").factory("debounce", function () {
	
	var _pending = {};

	function _debounce(tag, time, cb) {
		function do_debounce(callback) {
			clearTimeout(_pending[tag]);
			_pending[tag] = setTimeout(callback, time);
		}
		if (typeof cb === 'function')
			do_debounce(cb);
		else
			return do_debounce;
	}

	return _debounce;
});
