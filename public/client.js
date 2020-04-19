var socket = io();
var name;                   // current user name
var theme;                  // current user selected theme
var room_id;                // current room id user is in
var user1;                  // user1 name in the game (server decided)
var user2;                  // user2 name in the game (server decided)
var turn = false;           // true - this is your turn; false - thsi is not your turn , please wait
var grid;                   // game map (game board)
var winner;                 // win state: 1 - user 1 win, 2 - user 2 win, 3 - tie game
var current_theme;          // color for hover animation use, base on theme selected
var current_cell_hover;     // color for hover animation user, base on theme selelcted
var user1_chess_color = "firebrick";    // fixed color for player 1's move (chess)
var user2_chess_color = "orange";       // fixed color for player 2's move (chess)

$(function () {
    /**
     * use: initial user and create room when the web page is ready
     * do:  1. check user cookies to determined the welcome msg
     *      2. generate random name if needed
     *      3. sent event to server and ask to create a room base on the random unique number (room_id)
     */
    $(document).ready(function() {
        var value = getCookie("name");
        if (value) {
            // user have cookie
            document.getElementById("welcome_msg").innerText = "Welcome back";
            document.getElementById("fname").value = value;
            name = value;
            theme = getCookie("theme");
        } else {
            // user does not have cookie
            name = random_name();
            theme = 3;
            document.cookie = "name="+name;
            document.cookie = "theme="+theme;
        }
        room_id = ramdom_room_id();
        document.getElementById("room_id").innerText = room_id;
        socket.emit("create_room", {room_id, name});
    });

    /**
     * user: handle change on user name
     * do: take the new name value, set it to cookie and sent it to the server
     */
    $("#username").submit(function(e) {
        e.preventDefault();
        document.cookie = "name="+ $("#fname").val();
        socket.emit("change_name", {room_id, old_name: name, new_name: $("#fname").val()});
        name = $("#fname").val();
        return false;
    });

    /**
     * use: check input room id, when user enter a room id to be enter
     * do: prevent user enter his/her own unique number (room id), if not, then it will sent to server to handle it
     */
    $("#join_room").submit(function(e) {
        e.preventDefault();
        if ($("#join_room_id").val() != room_id) {
            socket.emit("join_room", {join_room_id: $("#join_room_id").val(), name, room_id});
        } else {
            $("#join_error").text("Sorry, can't join use your own code.");
        }
        return false;
    });

    /**
     * event name: room_full
     * use: listerning on server event, this event meaning the room user want to join is full  
     * do: show join_error message to indicate room full message
     */
    socket.on("room_full", function() {
        $("#join_error").text("Sorry, room full, please try other room.");
    });

    /**
     * event name: no_room_id
     * use: this event meaning the the room id user enter is invalid
     * do: show join_error message to indicate invalid room id message
     */
    socket.on("no_room_id", function() {
        $("#join_error").text("Sorry, no such room, please try other room.");
    });

    /**
     * event name: game_start
     * use: this event meaning server sent to room to tell both playe to initialize their game state, turn variable
     * do: set up variable for game initialization
     */
    socket.on("game_start", function(data) {
        room_id = data.new_room_id;
        user1 = data.user1;
        user2 = data.user2;
        document.getElementById("login-page").style.display = "none";
        document.getElementById("game-page").style.display = "block";
        document.getElementById("play_with").innerText = name == user1 ? user1 + ", you are playing with " + user2 + "." : user2 + ", you are playing with " + user1 + ".";
        init_game();
        switch_color(parseInt(theme));
    });

    /**
     * event name: move 
     * use: this event mean a valid move has been made by other player
     * do: update the game map (grid), and now is my game turn, set turn = true, accept user input in game board
     */
    socket.on("move", function(data) {
        turn = data.move == name ? true : false;
        document.getElementById("msg").innerText = turn ? name + ", it is your turn." : "Please wait for your turn.";
        console.log(name + "turn = " + turn);
        document.getElementById("msg").style.backgroundColor = turn ? "#EA5E3D" : "transparent";
    
        if (data.cell != null) {
            grid = data.grid;
            if (turn) document.getElementById(data.cell).style.backgroundColor = user1 == name ? user2_chess_color : user1_chess_color;
            if (!turn) document.getElementById(data.cell).style.backgroundColor = user1 == name ? user1_chess_color : user2_chess_color;    // try to not recolor your own move with oppoent's color
            document.getElementById(data.cell).classList.add("zoom");
        }
    });

    /**
     * event name: game_end
     * use: this event mean the game has end
     * do: show the game end result, and all player will leave the room
     */
    socket.on("game_end", function(data) {
        winner = data.winner;
        switch (winner) {
            case 1:
                document.getElementById("msg").innerText = user1 + " win, game end.";
                document.getElementById("game_end_pop_up_msg").src = user1 == name ? "https://media.giphy.com/media/K3RxMSrERT8iI/giphy.gif" : "https://media1.giphy.com/media/1xVfByxByNvUiclzzL/giphy.gif?cid=ecf05e47b311bb63e5f816c096fb07290d4e3e1e42cd5e8a&rid=giphy.gif";
                break;
            case 2:
                document.getElementById("msg").innerText = user2 + " win, game end.";
                document.getElementById("game_end_pop_up_msg").src = user2 == name ? "https://media.giphy.com/media/K3RxMSrERT8iI/giphy.gif" : "https://media1.giphy.com/media/1xVfByxByNvUiclzzL/giphy.gif?cid=ecf05e47b311bb63e5f816c096fb07290d4e3e1e42cd5e8a&rid=giphy.gif";
                break;
            case 3:
                document.getElementById("msg").innerText = "It is a draw, game end.";
                document.getElementById("game_end_pop_up_msg").src = "https://www.reactiongifs.com/r/2013/02/tied.gif";
                break;
        }
        setTimeout(function(){
            document.getElementById("game_end_pop_up_msg").style.display = "block";
        }, 2000);
        socket.emit("leave", {room_id});
    });

    /**
     * use: handle user click on "random" button to join queue 
     * do: send event to server to ask to join the queue
     */
    $("#random_queue").click(function(event) {
        document.getElementById("queue_msg").innerText = "Waiting for oppoent...";
        socket.emit("join_queue", {room_id, name})
    });

    /**
     * event name: game_start_random
     * use: this event happen when, user join random waiting queue, and there is enough people to start a game, server ask the player to update its own room id
     * do: update room_id variable
     */
    socket.on("game_start_random", function(data) {
        if (room_id != data.new_room_id) {
            socket.emit("join_room", {join_room_id: data.new_room_id, name, room_id});
        }
    });

    /** 
     * do: generate random numebr (unique number / room id) for all user in the index page 
     */
    function ramdom_room_id() {
        var num = (Math.floor(Math.random() * 1000)).toString();
        num += (Math.floor(Math.random() * 1000)).toString();
        num += (Math.floor(Math.random() * 10000)).toString();
        return num;
    }

    /**
     * use: function for check cookie in user's broswer
     */
    function getCookie(name) {
        let matches = document.cookie.match(new RegExp(
          "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }
    
    /** 
     * do: generate random user name for those who is first time in this website (no cookie) 
     */
    function random_name() {
        let parts = [];
        parts.push(["Dead", "Hairless", "Sadistic", "Metal", "Wild", "Abnormal", "Sexy", "Hot", "Frozen", "Useless", "Offensive", "Happy", "Sad", "Magical", "Slippery", "Greedy"]);
        parts.push([" factory reset button", " idiot", " legend", " goal in life", " grandma", " legs", " berry", " poop", " crazed master", " queen", " seat", " bug", " puppy", " law"]);
    
        var username = "";
        for( part of parts) {
              username += part[Math.floor(Math.random()*part.length)];
        }
        document.getElementById("fname").value = username;
        return username;
    }

    /** 
     * do: initializ game state variable 
     */
    function init_game() {
        grid = [[0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0]];
        winner = 0;     // 0 - game playing
        if (user1 == name) {
            socket.emit("game_ready", {room_id, user1, user2});
        }
    }
});

/**
 * do: handle user change name in index page without hitting enter key (just leave)
 */
function change_name(new_name) {
    document.cookie = "name="+new_name.value;
    socket.emit("change_name", {room_id, old_name: name, new_name: new_name.value});
    name = new_name.value;
}

/**
 * do: check user's move, valid or not, if valid will sent to server, if not indicate invalid move message
 */
function select(col) {
    if  (winner == 0 && turn) {
        var valid = false;
        for (let i = 5; i >= 0; i--) {
            if (grid[i][col] == 0) {
                var cell_id = "grid_" + i + "_" + col;
                grid[i][col] = user1 == name ? 1 : 2;   // 1 - user1's chess, 2 - user2's chess
                document.getElementById(cell_id).style.backgroundColor = user1 == name ? user1_chess_color : user2_chess_color;
                document.getElementById(cell_id).classList.add("zoom");
                valid = true;
                var wait = user1 == name ? user2 : user1;
                socket.emit("next", {room_id, wait, cell_id, grid});
                break;
            }
        }
        if (valid) {
            check_win();
        } else {
            document.getElementById("msg").innerText = name + ", this move is invalid, please try again.";
        }
    }
}

/**
 * do: handle mouse hover animation, indicate what move is valid 
 */
function mouseEnter(col) {
    for (let i = 0; i < 6; i ++) {
        if (grid[i][col] == 0) {
            document.getElementById("grid_"+i+"_"+col).style.backgroundColor = current_cell_hover;
        }
    }
}

/**
 * do: handle mouse hover animation, indicate what move is valid 
 */
function mouseLeave(col) {
    for (let i = 0; i < 6; i ++) {
        if (grid[i][col] == 0) {
            document.getElementById("grid_"+i+"_"+col).style.backgroundColor = current_theme;
        }
    }
}

// reference : https://codereview.stackexchange.com/questions/127091/java-connect-four-four-in-a-row-detection-algorithms
/**
 * do: after a move, will check if the game has end, who win, if not, game continue.
 */
function check_win() {
    var width = 7;
    var height = 6;
    for (let i = 0; i < height; i++) {
        for (let k = 0; k < width; k++) {
            var value = grid[i][k];
            if (value == 0) continue;
            
            if (k + 3 < width && value == grid[i][k+1] && value == grid[i][k+2] && value == grid[i][k+3]) {
                winner = value;
                i = height;
                break;
            };
            if (i + 3 < height) {
                if (value == grid[i+1][k] && value == grid[i+2][k] && value == grid[i+3][k]) {
                    winner = value;
                    i = height;
                    break;
                };
                if (k + 3 < width && value == grid[i+1][k+1] && value == grid[i+2][k+2] && value == grid[i+3][k+3]) {
                    winner = value;
                    i = height;
                    break;
                };
                if (k - 3 >= 0 && value == grid[i+1][k-1] && value == grid[i+2][k-2] && value == grid[i+3][k-3]) {
                    winner = value;
                    i = height;
                    break;
                };
            }
        }
    }

    // check draw condition
    if (winner == 0) {
        for (let i = 0; i < height; i++) {
            if (grid[i].includes(0)) {
                winner = 0;
                break;
            } else {
                winner = 3;
            }
        }
    }

    if (winner != 0) {
        socket.emit("game_end", {room_id, winner});
    }
}

/**
 * do: switch color theme function 
 */
function switch_color(num) {
    // remember to set the cookie
    switch (num) {
        case 1:
            document.cookie = "theme=" + 1;
            document.getElementById("main_body").style.backgroundImage = "url(https://i.pinimg.com/originals/8a/ce/a9/8acea9261c892e75b0651de1d4f4e0e1.jpg)";
            document.getElementsByClassName("play-area")[0].style.backgroundColor = "rgba(251, 141, 159, 0.6)";
            document.getElementsByClassName("play-area")[0].style.borderColor = "rgba(251, 69, 111, 0.918)";
            for (let i = 0; i < 6; i++) {
                for (let k = 0; k < 7; k++) {
                    document.getElementById("grid_" + i + "_" + k).style.borderColor = "rgba(251, 69, 111, 0.918)";
                    if (grid[i][k] == 0) {
                        document.getElementById("grid_" + i + "_" + k).style.backgroundColor = "rgba(251, 107, 143)";
                    }
                }  
            }
            current_theme = "rgba(251, 107, 143)";
            current_cell_hover = "rgb(255, 148, 175)";
            break;
        case 2:
            document.cookie = "theme=" + 2;
            document.getElementById("main_body").style.backgroundImage = "url(https://i.pinimg.com/originals/af/46/2b/af462b5059b87c1e7da7c6661b244f9e.jpg)";
            document.getElementsByClassName("play-area")[0].style.backgroundColor = "rgba(210, 251, 164, 0.6)";
            document.getElementsByClassName("play-area")[0].style.borderColor = "#1D741B";
            for (let i = 0; i < 6; i++) {
                for (let k = 0; k < 7; k++) {
                    document.getElementById("grid_" + i + "_" + k).style.borderColor = "#1D741B";
                    if (grid[i][k] == 0) {
                        document.getElementById("grid_" + i + "_" + k).style.backgroundColor = "#88CA5E";
                    }
                }  
            }
            current_theme = "#88CA5E";
            current_cell_hover = "rgb(170, 255, 115)";
            break;
        case 3:
            document.cookie = "theme=" + 3;
            document.getElementById("main_body").style.backgroundImage = "url(https://hdwallpapers2013.com/wp-content/uploads/2013/03/Sky-Wallpaper.jpg)";
            document.getElementsByClassName("play-area")[0].style.backgroundColor = "rgba(195, 224, 229, 0.6)";
            document.getElementsByClassName("play-area")[0].style.borderColor = "#274472";
            for (let i = 0; i < 6; i++) {
                for (let k = 0; k < 7; k++) {
                    document.getElementById("grid_" + i + "_" + k).style.borderColor = "#274472";
                    if (grid[i][k] == 0) {
                        document.getElementById("grid_" + i + "_" + k).style.backgroundColor = "#41729F";
                    }
                }  
            }
            current_theme = "#41729F";
            current_cell_hover = "rgb(102, 182, 255)";
            break;
    }
}