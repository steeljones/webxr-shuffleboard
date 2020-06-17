const cors = require('cors')
const express = require('express')
const fs = require('fs');
const https = require('https')
const http = require('http')

const saveFilepath = './game.json';

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3000
const HTTPSPORT = 3001

initServer()

function initServer(){
  const options = {
    key: fs.readFileSync(__dirname + '/server.key', 'utf8'),
    cert: fs.readFileSync(__dirname + '/server.crt', 'utf8')
  };
  
  http.createServer(app).listen(PORT)
  https.createServer(options, app).listen(HTTPSPORT)
  
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
}


