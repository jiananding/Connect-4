var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = 3001;

// variable storing all the room has been created
var rooms = new Map();
// variable storing all user who is waiting for random oppoent in queue
var queue = [];

server.listen(port, function() {
    console.log(`Server listerning at port ${port}`);
});

app.use(express.static('public'));

io.on('connection', function(socket){
    /**
     * event name: create_room
     * use: create room for user, and store user name in the room
     * input: user's unique number (as room number or room id), user name
     */
    socket.on("create_room", function(data) {
        socket.join(data.room_id);
        rooms.set(data.room_id, [data.name]);
    });

    /**
     * event name: change_name
     * use: change user name and restore it in to the rooms variable
     * input: user's room_id and his/her new user name
     */
    socket.on("change_name", function(data) {
        var value = rooms.get(data.room_id);
        value.pop();
        value.push(data.new_name);
        rooms.set(data.room_id, value);
    });

    /**
     * event name: join_room
     * use: let user to join other player'r room by input the unique number, server will check and do the work
     *      if it is valid and room is not full, user will join and start game with oppoent
     * input: current user room id, user name, room id for the room to be join
     */
    socket.on("join_room", function(data) {
        if (rooms.has(data.join_room_id)) {
            var value = rooms.get(data.join_room_id);
            if (value.length < 2) {
                // valid room id, and room is not full, able to join, set things up
                rooms.delete(data.room_id);
                socket.leave(data.room_id);
                value.push(data.name);
                rooms.set(data.join_room_id, value);
                var new_room_id = data.join_room_id;
                socket.join(new_room_id);
                io.sockets.in(new_room_id).emit("game_start", {new_room_id, user1: value[0], user2: value[1]});
            } else {
                // valid room id, but room is full, not able to join, send message back to sender
                io.sockets.in(data.room_id).emit("room_full");
            }
        } else {
            // invalid room id
            io.sockets.in(data.room_id).emit("no_room_id");
        }
    });

    /**
     * event name: game_ready
     * use: listen to player, when they initial the game state in the room, server will decide who play first
     * input: play room id, user 1 name, user 2 name
     */
    socket.on("game_ready", function(data) {
        var move, wait;
        if (Math.random() >= 0.5) {
            move = data.user1;
            wait = data.user2;
        } else {
            move = data.user2;
            wait = data.user1;
        }
        io.sockets.in(data.room_id).emit("move", {move});
    });

    /**
     * event name: next
     * use: after a valid move has been made by one of the player, server will send that data to other player, and ask he/she to make a move
     * input: room id, game gird (all cell data), player's move (cell number), and the name who is not moving for this turn
     */
    socket.on("next", function(data) {
        var move = data.wait;
        var cell = data.cell_id;
        var grid = data.grid;
        io.sockets.in(data.room_id).emit("move", {move, cell, grid});
    });

    /**
     * event name: game_end
     * use: the game end, need to sent msg to all player in room to indicate game end
     * input: room id, who win (win code, 1 for user 1 win, 2 for user 2 win, 3 for tie game)
     */
    socket.on("game_end", function(data) {
        var winner = data.winner;
        io.sockets.in(data.room_id).emit("game_end", {winner});
    });

    /**
     * event name: join_queue
     * use: when user click 'random', will be put into a queue and wait for other oppoent, start game when there has enough player
     * input: room id, player name
     */
    socket.on("join_queue", function(data) {
        var value = [data.room_id, data.name];
        queue.push(value);
        if (queue.length == 2) {
            let user1 = queue.pop();
            let user2 = queue.pop();
            let new_room_id = user1[0];
            io.sockets.in(user1[0]).emit("game_start_random", {new_room_id, user1: user1[1], user2: user2[1]});
            io.sockets.in(user2[0]).emit("game_start_random", {new_room_id, user1: user1[1], user2: user2[1]});
        }
    });

    /**
     * event name: leave
     * use: delete room after a game has end
     * input: room id
     */
    socket.on("leave", function(data) {
        socket.leave(data.room_id);
    });
});
