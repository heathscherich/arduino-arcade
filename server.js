// server.js
var express        = require('express');
var app            = express();
var httpServer = require("http").createServer(app);
var five = require("johnny-five");
var io = require('socket.io')(httpServer);


var port = 3000;

app.use(express.static(__dirname + '/'));

app.get('/', function(req, res) {
        res.sendFile(__dirname + '/index.html');
});

httpServer.listen(port);
console.log('Server available at http://localhost:' + port);

//Arduino board connection
var leds, button, endgame, pressed, step,
    ledArraySize;

var board = new five.Board({repl: false});
board.on("ready", function() {
    console.log('Arduino connected');
    var ledPins = [2,3,4,5,6,7,8,9,10];
    leds = new five.Leds(ledPins);
    ledArraySize = leds.length-1;

    button = new five.Button(12);
});

//Socket connection handler
io.on('connection', function (socket) {
    /**
    * Blue Devil
    * Lights in a row flash one after the other and
    * the player should stop the light on a blue LED
    * using a button
    */
    var pause, temp;
    function bluedev(step){
        if(endgame || pressed){
            if(pressed){ socket.emit('score', 5-Math.abs(ledArraySize/2-step+1)); }
            return;
        }

        pause = 50*(Math.abs(ledArraySize/2-step)+1);
        if(leds[step-1]){
            leds[step-1].off();
        }
        leds[step].on();

        if(step++ < leds.length-1) {
            board.wait(pause, function(){
                bluedev(step);
            });
        } else {
            for(var i=0; i<=ledArraySize/2; ++i){
                temp = leds[i];
                leds[i] = leds[ledArraySize-i];
                leds[ledArraySize-i] = temp;
            }
            board.wait(pause, function(){
                leds[ledArraySize].off();
                step = 0;
                bluedev(step);
            });
        }
    }

    /**
    * Light tower
    * The player is faced with falling lights that
    * he should try and build a tower from
    */
    var towerHeight;
    function tower(step){
        if(pressed){
            console.log(step + '||' + towerHeight);
            if(step == towerHeight-1){
                towerHeight++;
                console.log(towerHeight + '!!' + ledArraySize);
            } else {    //you lose
                console.log('reset');
                towerHeight = 1;
            }
            return;
        } else if(endgame){
            return;
        }

        pause = 50*(ledArraySize-towerHeight + 3);
        for(var i=0; i<towerHeight; i++){
            leds[i].on();
        }
        if(leds[step+1]){
            leds[step+1].off();
        }
        leds[step].on();

        if(step-- >= towerHeight){
            board.wait(pause, function(){
                tower(step);
            });
        } else {
            leds[ledArraySize].off();
            step = ledArraySize;
            tower(step);
        }

    }

    function flipflop(step){

    }
    /**
    * Event which triggers the Blue Devil game
    */
    socket.on('start:bluedev', function(){
        // Register listeners
        button.on("press", function(){
            if(pressed == true){ return; }
            pressed = true;
            board.wait(2000, function(){
                leds.off();
                pressed = false;
                step = 0;
                bluedev(step)
            });
        });

        endgame = false;
        step = 0;
        bluedev(step);
    });

    /**
    * Event triggering the Light Tower game
    */
    socket.on('start:tower', function(){
        button.on('press', function(){
            if(pressed == true){ return; }
            pressed = true;
            if(towerHeight != ledArraySize){
                board.wait(2000, function(){
                    for(var i=ledArraySize; i>=towerHeight; i--){
                        leds[i].off();
                    }
                    pressed = false;
                    tower(ledArraySize);
                });
            } else {    // WINNER
                console.log('how am i here');
                board.wait(250, function(){
                    leds[ledArraySize].on();
                    leds.strobe(1000, function(){
                        console.log('strobe1 working');
                        board.wait(100, function(){
                            leds.stop();
                            leds.off();
                        });
                    });
                    board.wait(1100, function(){
                        leds.strobe(1000, function(){
                            console.log('strobe2 working');
                            board.wait(100, function(){
                                leds.stop();
                                leds.off();
                            });
                            towerHeight = 1;
                            pressed = false;
                            tower(ledArraySize);
                        });
                    });
                });
            }
        });

        endgame = false;
        towerHeight = ledArraySize-1;
        tower(ledArraySize);
    });
    /**
    * Ends the current playing game
    */
    socket.on('stop', function(game){
        //button.removeEventListener("press", function(){}     )
        endgame = true;
        leds.off();
    })
});

console.log('Waiting for connection');
