// Heath Scherich
// Source:  https://www.codetutorial.io/nodejs-socket-io-and-jhonny-five-to-control-arduino/
// index.html rewritten and server.js heavily editted

var express = require('express');

const app = express(),
    httpServer = require("http").createServer(app),
    five = require("johnny-five"),
    io = require('socket.io')(httpServer),
    port = 3000;

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

        pause = 50*(Math.abs(ledArraySize/2-step));
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
            if(step == towerHeight-1){
                towerHeight++;
            } else {    //you lose
                socket.emit('score', towerHeight);
                towerHeight = 1;
            }
            return;
        } else if(endgame){
            return;
        }

        pause = 50*(ledArraySize-towerHeight);
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
            if(towerHeight != ledArraySize-1){
                board.wait(2000, function(){
                    for(var i=ledArraySize; i>=towerHeight; i--){
                        leds[i].off();
                    }
                    pressed = false;
                    tower(ledArraySize);
                });
            } else {    // WINNER
                board.wait(250, function(){
                    leds[ledArraySize].on();
                    leds.strobe(500);
                    board.wait(4000, function(){
                        leds.stop();
                        leds.off();
                    });
                    pressed = false;
                    socket.emit('gameover');
                });
            }
        });

        endgame = false;
        towerHeight = 1;
        tower(ledArraySize);
    });
    /**
    * Ends the current playing game
    */
    socket.on('stop', function(){
        if(button._events){
            button._events.press = null;    // hax
        }
        endgame = true;
        leds.off();
    })
});

console.log('Waiting for connection');
