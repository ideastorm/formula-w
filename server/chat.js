/* 
 * Copyright 2015 phil.
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

module.exports.bind = function (socket, io, players) {
    socket.on('chatMessage', function (message) {
        if (socket.userId) {
            var player = players.lookup(socket.userId);
            console.log(player + ": " + message);
            var gameId = socket.gameId;
            if (gameId) {
                io.to(gameId).emit("chatMessage", {from: player, message: message});
            }
        }
    });
}
