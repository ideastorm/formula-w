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

var deepCopy = require('./deepCopy');

var autoMoveTimeout = null;

module.exports.bind = function (socket, io, games) {

	function _setWarning(player, message, action, delay, warnDelay) {
		clearTimeout(autoMoveTimeout);
		function _warnPlayer() {
			autoMoveTimeout = setTimeout(action, delay);
			io.to(io.users[player.id]).emit("chatMessage", {
				from : "System",
				message : message
			});
		}
		autoMoveTimeout = setTimeout(_warnPlayer, warnDelay);
	}

	function _autoGearSelect() {
		var game = games.lookup(socket);
		if (!game.running)
			return;
		var player = game.players[game.activePlayer];
		var targetGear = Math.min(player.activeGear + 1, Math.max(player.activeGear - 1, 3));
		_gearSelect(targetGear, game.activePlayer);
	}

	function _autoMoveSelect() {
		var game = games.lookup(socket);
		if (!game.running)
			return;
		var player = game.players[game.activePlayer];
		var moves = player.moveOptions;
		var best = 100;
		var bestIndex = null;
		for (var i = moves.length - 1; i >= 0; i--) {
			var move = moves[i];
			if (move.totalDamage < best) {
				best = move.totalDamage;
				bestIndex = i;
			}
		}
		if (typeof bestIndex === 'number')
			_selectMove(bestIndex, game.activePlayer);
	}

	function _gearSelect(selectedGear, forcePlayer) {
		clearTimeout(autoMoveTimeout);
		var game = games.lookup(socket);
		var playerIndex = games.getPlayerIndex(game, socket.userId);
		if (typeof forcePlayer === 'number')
			playerIndex = forcePlayer;
		if (playerIndex === game.activePlayer) {
			var player = game.players[playerIndex];
			if (!player.gearSelected) {
				_validateAndUpdateGearSelection(game, player, +selectedGear);
				if (player.gearSelected)
					setTimeout(function () {
						_calculateMoveOptions(game, player);
						_setWarning(player,
							"A move will be selected for you in 10 seconds",
							_autoMoveSelect,
							10000,
							30000);
					}, 100);
				else
					io.to(game.id).emit("updatePlayers", game.players);
			}
		}
	}

	function _selectMove(selectedMove, forcePlayer) {
		clearTimeout(autoMoveTimeout);
		var game = games.lookup(socket);
		var playerIndex = games.getPlayerIndex(game, socket.userId);
		if (typeof forcePlayer === 'number')
			playerIndex = forcePlayer;
		if (playerIndex === game.activePlayer) {
			var player = game.players[playerIndex];
			var move = player.moveOptions[selectedMove];
			if (move.space < player.location) {
				player.lap++;
			}
			io.to(game.id).emit("activePlayerMove", move.path);
			var delay = move.path.length * 250;
			console.log("delay before finishing processing: " + delay);
			setTimeout(function () {
				if (move.slowStop)
					player.skipNext = true;
				if (move.pitStop) {
					player.activeGear = 3; //allows gear 4 or lower
				}
				_applyDamage(game, player, move);
				player.location = move.space;
				_adjacentDamage(game, player);
				player.allowIn = move.allowIn;
				player.allowOut = move.allowOut;
				if (player.corner && player.corner === move.corner)
					player.cornerStops++;
				else {
					player.corner = move.corner;
					if (move.corner)
						player.cornerStops = 1;
					else
						player.cornerStops = 0;
				}
				player.moveOptions = [];
				if (player.lap > game.laps) {
					_gameOver(game, player);
                    return;
				}
				_nextPlayer();
			}, delay);
		}
	}

	function _nextPlayer() {
		var game = games.lookup(socket);
		if (!game)
			return;
		if (!game.running)
			return;

		if (!game.playerOrder.length) {
			console.log("Recycling player list");
			_sortPlayers(game);
		}
		game.activePlayer = game.playerOrder.shift();

		console.log("active player: " + game.activePlayer);
		if (typeof game.activePlayer === 'number') {
			var nextPlayer = game.players[game.activePlayer];
			if (nextPlayer.skipNext) {
				nextPlayer.skipNext = false;
				io.to(game.id).emit("chatMessage", {
					from : nextPlayer.name,
					message : "I had a slow pit stop - skipping my turn"
				});
				setTimeout(_nextPlayer, 1000); //give some time for people to read the message
			} else {
				nextPlayer.gearSelected = false;
				io.to(game.id).emit("updatePlayers", game.players);
				io.to(game.id).emit("currentPlayer", game.activePlayer);
				_setWarning(nextPlayer,
					"A gear will be automatically selected in 10 seconds",
					_autoGearSelect, 10000, 10000);
			}
		} else {
			_gameOver(game, null);
		}
	}

	socket.on('gearSelect', _gearSelect);
	socket.on('selectMove', _selectMove);

	function _isMyPitStop(game, playerInfo, spaceIndex) {
		var playerIndex;
		if (typeof playerInfo === 'number')
			playerIndex = playerInfo;
		else
			playerIndex = game.players.indexOf(playerInfo);
		return game.map.pitStops.indexOf(spaceIndex) === playerIndex;
	}

	function _validateAndUpdateGearSelection(game, player, selectedGear) {
		console.log("desired gear: " + selectedGear);
		console.log(typeof selectedGear);
		if (typeof selectedGear !== 'number' || selectedGear < 1 || selectedGear > 6 || selectedGear > player.activeGear + 1)
			return;
		if (_isMyPitStop(game, player, player.location)) {
			console.log("accepting gear selection based on presence in pit stop");
			player.gearSelected = true;
			player.activeGear = selectedGear;
			io.to(game.id).emit("chatMessage", {
				from : player.name,
				message : "I'm leaving the pits in gear " + selectedGear
			});
			return;
		}
		var damage = (player.activeGear - 1) - selectedGear;
		console.log("damage from selecting desired gear: " + damage);
		var availableDamage = !game.advanced ? player.damage : player.damage.transmission;
		console.log("available damage: " + availableDamage);
		if (availableDamage < damage || damage > 3) {
			console.log("rejecting gear selection");
			socket.emit("chatMessage", {
				from : "System",
				message : "Down shifting to " + selectedGear + " would destroy your car, and is not allowed."
			});
			return;
		}
		console.log("accepting gear selection");
		player.gearSelected = true;
		player.activeGear = selectedGear;
		io.to(game.id).emit("chatMessage", {
			from : player.name,
			message : "I'm using gear " + selectedGear
		});
		if (damage > 0) {
			console.log("taking damage");
			io.to(game.id).emit("chatMessage", {
				from : player.name,
				message : "I took " + damage + " damage for aggressive down shifting"
			});
			if (!game.advanced) {
				player.damage -= damage;
			} else {
				player.damage.transmission -= damage;
			}
		}
	}

	function _movementPoints(gear) {
		var options;
		switch (gear) {
		case 1:
			options = [1, 2];
			break;
		case 2:
			options = [2, 3, 4];
			break;
		case 3:
			options = [4, 5, 6, 7, 8];
			break;
		case 4:
			options = [7, 8, 9, 10, 11, 12];
			break;
		case 5:
			options = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
			break;
		case 6:
			options = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
			break;
		default:
			return 1;
		}
		var index = Math.floor(Math.random() * options.length);
		return options[index];
	}

	function _calculateMoveOptions(game, player) {
		var map = game.map;
		var corners = map.corners;
		var playerLocations = _getPlayerLocations(game.players);
		var movePoints = _movementPoints(player.activeGear);

		if (typeof player.firstRoll === 'undefined') {
			var rand = Math.ceil(20 * Math.random());
			if (rand === 1) {
				player.firstRoll = 'poor';
				io.to(game.id).emit('chatMessage', {
					from : player.name,
					message : 'Poor start!  I lost my turn'
				});
				_nextPlayer();
				return;
			} else if (rand === 20) {
				player.firstRoll = 'great';
				io.to(game.id).emit('chatMessage', {
					from : player.name,
					message : 'Great start!'
				});
				movePoints = 4;
			} else {
				io.to(game.id).emit('chatMessage', {
					from : player.name,
					message : 'Normal start.'
				});
				player.firstRoll = 'normal';
			}
		}
		var touchedSpaces = 0;
		console.log(player.name + " rolled a " + movePoints + ", calculating move options");
		io.to(game.id).emit("chatMessage", {
			from : player.name,
			message : "I rolled a " + movePoints
		});
		var availableSpaces = [];
		var workQueue = [{
				space : player.location,
				distance : 0,
				path : [],
				swerve : 0,
				allowIn : player.allowIn,
				allowOut : player.allowOut,
				corner : player.currentCorner,
				cornerStops : player.cornerStops,
				cornerDamage : 0,
				addCornerDamage : 0
			}
		];
		var lastDistance = 0;
		var locationsThisDistance = [];
		_processQueue();

		function _processQueue() {
			touchedSpaces++;

			var entry = workQueue.shift();
			if (entry.distance + 1 > lastDistance) {
				lastDistance = entry.distance + 1;
				locationsThisDistance = [];
				console.log("starting work on spaces at distance " + lastDistance + " (" + touchedSpaces + " spaces already processed)");
			}

			var space = map.spaces[entry.space];

			var swerveIndex = 0;
			var newEntry;

			if (space.forward !== null) {
				if (_isBlocked(space.forward))
					swerveIndex = 1;
				else
					newEntry = _pushOption(space.forward, Math.abs(entry.swerve) === 1 ? entry.swerve * 2 : 0);
			}

			if (space.outside !== null) {
				if (!_isBlocked(space.outside) && (entry.allowOut || entry.swerve === -2)) {
					newEntry = _pushOption(space.outside, swerveIndex);
					if (entry.swerve !== -2 && !space.corner)
						newEntry.allowIn = false;
				}
			}

			if (space.inside !== null) {
				if (!_isBlocked(space.inside) && (entry.allowIn || entry.swerve === 2)) {
					newEntry = _pushOption(space.inside, swerveIndex);
					if (entry.swerve !== 2 && !space.corner)
						newEntry.allowOut = false;
				}
			}

			if (workQueue.length)
				setTimeout(_processQueue, 1);
			else {
				console.log("processed " + touchedSpaces + " spaces and found " + availableSpaces.length + " options");
				_mergeOptions(availableSpaces);
				console.log("merged available options, " + availableSpaces.length + " now available");
				player.moveOptions = availableSpaces;

				io.to(game.id).emit("updatePlayers", game.players);
			}

			function _pushOption(spaceIndex, isSwerve) {
				var distance = entry.distance + 1;
				var processDownstream = distance < movePoints;
				var damageMsg = "";
				var brakingDamage = Math.max(0, movePoints - distance);
				var tireDamage = Math.max(0, Math.min(brakingDamage - 3, 3));
				var brakeDamage = Math.min(brakingDamage, 3);
				if (brakeDamage > 0)
					damageMsg = brakeDamage + " brake damage";
				if (tireDamage > 0)
					damageMsg += " and " + tireDamage + " tire damage from braking";
				var destroy = brakingDamage > 6;
				if (destroy)
					damageMsg = "Braking 7+ spaces destroys your car";
				var newPath = deepCopy(entry.path);
				newPath.push(spaceIndex);
				var nextEntry = {
					space : spaceIndex,
					brakingDamage : brakeDamage,
					tireDamage : tireDamage,
					totalDamage : brakeDamage + tireDamage,
					destroy : destroy,
					damageMsg : damageMsg,
					distance : distance,
					path : newPath,
					swerve : isSwerve,
					allowIn : (space.corner ? true : entry.allowIn),
					allowOut : (space.corner ? true : entry.allowOut),
					cornerStops : entry.cornerStops,
					addCornerDamage : entry.addCornerDamage
				};

				_processCornerDamage();

				if (_isMyPitStop(game, player, spaceIndex)) {
					nextEntry.pitStop = true;
					nextEntry.allowOut = true;
					nextEntry.slowStop = _percentChance(50);
					nextEntry.totalDamage -= nextEntry.brakingDamage;
					nextEntry.totalDamage -= nextEntry.tireDamage;
					nextEntry.brakingDamage = 0;
					nextEntry.tireDamage = 0;
					if (!game.advanced) {
						nextEntry.totalDamage = Math.ceil((player.damage - 20) / 2); //should give a negative number so we actually repair
						nextEntry.damageMsg = "Pit Stop: Half of all damage repaired!";
					} else {
						nextEntry.tireDamage = player.damage.tires - 10;
						nextEntry.totalDamage += nextEntry.tireDamage;
						nextEntry.damageMsg = "Pit Stop: Tire damage repaired!";
					}
					nextEntry.destroy = false;
					processDownstream = false;
				}

				if (locationsThisDistance.indexOf(spaceIndex) < 0) {
					locationsThisDistance.push(spaceIndex);
					availableSpaces.push(nextEntry);
					if (processDownstream)
						workQueue.push(nextEntry);
				}
				return nextEntry;

				function _processCornerDamage() {
					var target = map.spaces[spaceIndex];
					var cornerStops = entry.cornerStops;
					nextEntry.corner = target.corner;
					nextEntry.cornerDamage = entry.cornerDamage;
					if (!target.corner)
						nextEntry.cornerStops = 0;
					if (!target.corner && entry.corner) {
						var corner = corners[entry.corner - 1];
						if (cornerStops < corner.requiredStops)
							nextEntry.addCornerDamage++;
						if (cornerStops < corner.requiredStops - 1) {
							nextEntry.damageMsg = "Overshooting a corner by more than 1 required stop destroys your car";
							nextEntry.destroy = true;
							processDownstream = false;
						}
					}
					nextEntry.cornerDamage += nextEntry.addCornerDamage;
					nextEntry.totalDamage += nextEntry.cornerDamage;
					if (nextEntry.cornerDamage && !nextEntry.destroy) {
						var cornerDamageMsg = nextEntry.cornerDamage + " tire damage from overshooting a corner";
						if (nextEntry.damageMsg === "")
							nextEntry.damageMsg = cornerDamageMsg;
						else
							nextEntry.damageMsg += " and " + cornerDamageMsg;
					}
					if (!game.advanced) {
						if (nextEntry.totalDamage >= player.damage) {
							nextEntry.destroy = true;
						}
					} else
						console.log("Advanced damage not implemented");
				}
			}

			function _isBlocked(spaceIndex) {
				var blockingPlayerIndex = playerLocations.indexOf(spaceIndex);
				return blockingPlayerIndex >= 0 && !_isMyPitStop(game, blockingPlayerIndex, spaceIndex);
			}
		}

		function _getPlayerLocations(players) {
			var locations = [];
			for (var i = 0; i < players.length; i++) {
				locations.push(players[i].location);
			}
			return locations;
		}
		function _mergeOptions(options) {
			var optionMap = {};
			for (var i = 0; i < options.length; i++) {
				var option = options[i];
				var conflict = optionMap[option.space];
				if (conflict && conflict.totalDamage < option.totalDamage)
					continue;
				optionMap[options[i].space] = option;
			}
			options.length = 0;
			for (var key in optionMap) {
				options.push(optionMap[key]);
			}
		}
	}

	function _remainingPlayers(game) {
		var players = [];
		for (var i = 0; i < game.players.length; i++) {
			if (!game.players[i].destroyed)
				players.push(game.players[i]);
		}
		return players;
	}

	function _sortPlayers(game) {
		var players = game.players;
		var spaces = game.map.spaces.length;
		var locations = [];
		for (var i = 0; i < players.length; i++) {
			var player = players[i];
			if (!player.destroyed)
				locations.push(player.lap * spaces + player.location);
		}
		console.log(locations);
		var sortedLocations = deepCopy(locations);
		sortedLocations.sort();
		console.log(sortedLocations);
		for (var i = sortedLocations.length - 1; i >= 0; i--) {
			game.playerOrder.push(locations.indexOf(sortedLocations[i]));
		}
		console.log(game.playerOrder);
	}

	function _gameOver(game, winner) {
		var message = {
			winner : winner ? winner.name : null
		};
		io.to(game.id).emit("gameOver", message);
		game.running = false;
		game.players = [];
		game.activePlayer = null;
		games.gameOver(game);
	}

	function _applyDamage(game, player, move) {
		if (!game.advanced)
			simpleDamage();
		else
			advancedDamage();
		if (move.destroy) {
			io.to(game.id).emit("chatMessage", {
				from : "System",
				message : player.name + " is out of the race!"
			});
			player.destroyed = true;
			var remaining = _remainingPlayers(game);
			if (remaining.count === 1) {
				_gameOver(game, remaining[0]);
			}
		}

		function simpleDamage() {
			player.damage -= move.totalDamage;
			if (player.damage <= 0)
				move.destroy = true;
			if (move.totalDamage > 0)
				io.to(game.id).emit("chatMessage", {
					from : player.name,
					message : "I took " + move.totalDamage + " damage"
				});
			else if (move.totalDamge < 0)
				io.to(game.id).emit("chatMessage", {
					from : player.name,
					message : (0 - move.totalDamage) + " damage was repaired in the pits."
				});
		}

		function advancedDamage() {
			io.to(game.id).emit("chatMessage", {
				from : "System",
				message : "Damage for advanced games isn't implemented!"
			});
		}
	}

	function _percentChance(percentChance) {
		return Math.random() * 100 <= percentChance;
	}

	function _checkDamage(game, player) {
		if (!game.advanced) {
			if (player.damage <= 0) {
				io.to(game.id).emit("chatMessage", {
					from : "System",
					message : player.name + " is out of the race!"
				});
				player.destroyed = true;
			}
		}
	}

	function _adjacentDamage(game, player) {
		function _isPitStop(spaceIndex) {
			return game.map.pitStops.indexOf(spaceIndex) >= 0;
		}

		if (_isPitStop(player.location))
			return;
		var space = game.map.spaces[player.location];
		var adjacentSpaces = [];
		var i;
		for (i = 0; i < space.adjacent.length; i++)
			if (!_isPitStop(space.adjacent[i]))
				adjacentSpaces.push(space.adjacent[i]);

		for (i = 0; i < space.moveTargets.length; i++)
			if (!_isPitStop(space.moveTargets[i]))
				adjacentSpaces.push(space.moveTargets[i]);

		var adjacentPlayers = [];
		for (i = 0; i < game.players.length; i++) {
			if (adjacentSpaces.indexOf(game.players[i].location) >= 0) {
				adjacentPlayers.push(game.players[i]);
				adjacentPlayers.push(player); //once for each adjacent player
			}
		}
		while (adjacentPlayers.length) {
			var p = adjacentPlayers.shift();
			if (_percentChance(5)) {
				if (!game.advanced) {
					p.damage--;
				} else {
					p.damage.body--;
				}
				io.to(game.id).emit("chatMessage", {
					from : p.name,
					message : "I take 1 body damage"
				});
				_checkDamage(game, p);
			} else
				io.to(game.id).emit("chatMessage", {
					from : p.name,
					message : "No damage for me!"
				});
		}
	}

};
