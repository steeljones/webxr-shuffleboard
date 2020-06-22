const cors = require('cors')
const fs = require('fs');
const https = require('https')
const http = require('http')
const { v4: uuidv4 } = require('uuid');

const express = require('express')
const app = express()

const saveFilepath = './game.json';

app.use(cors())
app.use(express.json())

const PORT = 3000
const HTTPSPORT = 3001

let gamesById = {},
    io;

initServer()

function initServer(){
  const options = {
    key: fs.readFileSync(__dirname + '/server.key', 'utf8'),
    cert: fs.readFileSync(__dirname + '/server.crt', 'utf8')
  };
  
  const server = http.createServer(app)
  io = require('socket.io')(server);
  server.listen( PORT );
  
  const httpsServer = https.createServer(options, app);
  const wssIo = require('socket.io')(httpsServer);
  httpsServer.listen(HTTPSPORT);
  
  app.get('/game', (req, res) => {
    if(fs.existsSync(saveFilepath)){
      let data = fs.readFileSync(saveFilepath, 'utf8');
      res.json(JSON.parse(data));
    }else{
      res.json({});
    }
  })

  app.post('/saveGame', (req, res) => {
    const data = req.body.data
    console.log('saved game')
    fs.writeFileSync(saveFilepath, JSON.stringify(data));
    res.send('saved game')
  });

  io.on('connection', socket => {
    console.log('new connection')

    socket.on('join-game', handleJoinGame);
    socket.on('new-game', handleNewGame);
    socket.on('disconnect', handleDisconnect)
    socket.on('update-game', handleUpdateGame)
    socket.on('update-world', handleUpdateWorld)
  });
}

function handleWSMessage(message){
  console.log( 'ws message: ', message );
}

function handleNewGame(data){
  let gameId = uuidv4();
  console.log('New game: ', gameId)
  gamesById[gameId] = { red: this };
  this.emit('joined-game', { gameId, playerColor: 'red' })
  this.join(gameId)  
}

function handleJoinGame(data){
  let { gameId, playerColor } = data;
  //TODO - test to make sure only 2 players are allowed to join a game
  if( gameId && gamesById[gameId] ){
    let room = io.nsps['/'].adapter.rooms[gameId];
    playerColor = playerColor ? playerColor : room ? 'blue' : 'red';

    if(playerColor == 'blue'){
      gamesById[gameId].red.emit('new-player', {})
      gamesById[gameId].blue =  this;
    }else{
      gamesById[gameId].red =  this;
    }
    
    this.join(gameId)
    this.emit('joined-game', { gameId, playerColor })
    
  }else if(gameId){
    //If this game doesn't exist, create it with this id
    this.emit('joined-game', { gameId, playerColor: 'red' })
    this.join(gameId)
    gamesById[gameId] = { red: this };
  }else{
    //should only happen if gameId is undefined
    handleNewGame.call(this);
  }
}

function handleDisconnect(){
  //TODO - remove player from a game, switch blue in that game to red and notify them
}

function handleUpdateGame(data){
  if(data.playerColor == 'red' && gamesById[data.gameId].blue){
    gamesById[data.gameId].blue.emit('update-game', data)
  }else if (data.playerColor == 'blue' && gamesById[data.gameId].red){
    gamesById[data.gameId].red.emit('update-game', data)
  }
}

function handleUpdateWorld(data){
  //console.log(data.playerColor, gamesById[data.gameId].blue)
  if(data.playerColor == 'red' && gamesById[data.gameId].blue){
    gamesById[data.gameId].blue.emit('update-world', data)
  }else if (data.playerColor == 'blue' && gamesById[data.gameId].red){
    gamesById[data.gameId].red.emit('update-world', data)
  }
}

