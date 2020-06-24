<script>
 import { onMount } from 'svelte';
 import Overlay from './Overlay.svelte';
 import ARRenderer from './ARRenderer.svelte';
 import io from 'socket.io-client';

 let DEV_MODE = window.location.search.includes( 'dev' );
 let DEBUG_MODE = window.location.search.includes( 'debug' );

 let overlayComponent, rendererComponent, overlayContainer;

 let arReady = false;
 let appReady = false;
 let sessionActive = window.location.search.includes( 'overlay' )? true : false;
 //let sessionActive = true;

 let controls = ['court', 'throw']
 let currentControl = 'court';
 let lastControl;

 //props passed to overlay for text
 let overlayTextState = 'clear';
 let winningPlayer;
 let discInPlay = false;

 let gameScore = { red: 0, blue: 0 };
 window.gameScore = gameScore

 let numberDevices = 1;
 let devicePlayerColor = 'red';
 
 let showContinueButton = false;

 //Variables set in dat.gui that then get passed to renderer
 let gameScale = DEV_MODE ? 1 / 2 : 1 / 4;
 let numDiscs = 8;
 let currentGameId;

 let socket;

 onMount( connectWS );

 $:showOverlay = arReady && appReady;

 $: {
   window.currentControl = currentControl
 }
 
 if('xr' in navigator){
   navigator.xr.isSessionSupported('immersive-ar').then( supported => {
     arReady = supported;
   });
 }

 function initApp(){
   appReady = true;
 }

 function handleStartClick(){
   sessionActive = true;
   rendererComponent.startSession()
   overlayTextState = 'movePhone'
 }

 function handleEndClick(){
   sessionActive = false;
   rendererComponent.endSession();
 }

 function handleChangeControls({detail={}}){
   let {controlType} = detail;
   if(controlType){
     lastControl = currentControl;
     currentControl = controlType;
   }
 }

 function handleUpdateScore({detail}){
   let {color, value, gameOver} = detail

   if(value > 0){
     //TODO - play sound effect
     gameScore[color] += value;     
   }
   if(!gameOver){
     overlayTextState = 'roundOver'
   }
 }

 function handleGameOver({detail}){
   let { winner } = detail;
   winningPlayer = winner;
   overlayTextState = 'gameOver';
   console.log('GAME WON: ', winner);
   setTimeout( enableTapToPlayAgain, 4000 );
 }

 function enableTapToPlayAgain(){
   overlayTextState = 'tapToPlayAgain'
   currentControl = 'inactive';
 }

 function handleStartGame(){
   gameScore.red = 0;
   gameScore.blue = 0;
   currentControl = 'throw';
   overlayTextState = 'clear'
   overlayComponent.reset();
   if( numberDevices > 1 && devicePlayerColor == 'red'){
     socket.emit('update-game', {event: 'startGame', playerColor: devicePlayerColor, gameId: currentGameId});
   }
 }

 function handleStartRound(){
   overlayTextState = 'clear'
   currentControl = 'throw'
 }

 function handleUpdateValueFromOverlay({detail}){
   let [key, value] = Object.entries(detail)[0];
   if(key == 'gameScale'){
     gameScale = value;
   }else if(key == 'numDiscs'){
     numDiscs = value;
   }
 }

 function handleSwitchPlayers({detail}){
   let { nextPlayer } = detail;
   if(DEV_MODE){
     //Just a sanity check to make sure this doesn't get called in dev mode
     console.error('No switching players in dev mode')
   }else{
     currentControl = 'switchingPlayers';
     overlayTextState = 'switchPlayers'
     setTimeout( () => {
       showContinueButton = true;
     }, 500 );
   }
 }

 function handleContinueClick({detail}){
   if(currentControl == 'switchingPlayers'){
     overlayTextState = 'clear';
     showContinueButton = false;
     rendererComponent.moveOnToNextTurn();
   }
 }

 function handleDiscInPlayStatus({detail}){
   let { status } = detail;
   discInPlay = status;
 }

 function handlePlaneDetectionStateUpdate({detail}){
   let { planeDetected } = detail;
   
   if(planeDetected){
     overlayTextState = 'setCourt';
   }else{
     
   }
 }

 function handleCourtSet(){
   currentControl = 'inactive';
   overlayTextState = 'tapToStart'
 }

 function handleResetCourt(){
   currentControl = lastControl;
 }

 function handleSetScore({detail}){
   let { red, blue } = detail;
   gameScore.red = red;
   gameScore.blue = blue;
 }

 function connectWS(){
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   //const io = new WebSocket(`${protocol}//${window.location.hostname}:${protocol == wss ? 3001 : 3000}`);
   let wsUrl = `http://${window.location.hostname}:${protocol == 'wss' ? 3001 : 3000}`
   socket = io.connect(wsUrl);

   socket.on('connect', handleWSOpen);
   socket.on('joined-game', handleJoinedGame);
   socket.on('new-player', handleNewPlayer);
   socket.on('update-game', handleUpdateGame)
   socket.on('update-world', handleUpdateWorld)
 }

 function handleWSOpen(){
   console.log('connected to ws')
   let hash = window.location.hash;
   if(hash){
     let [ gameId, devicePlayerColor ] = hash.replace('#', '').split(',');
     socket.emit('join-game', {gameId, playerColor: devicePlayerColor});
   }else{
     console.log('new game')
     socket.emit('new-game', hash.replace('#', ''));
   }
 }

 function handleWSError(){
   console.log('WS error: ', err)
 }

 function handleJoinedGame( message ){
   let { gameId, playerColor } = message;
   let hash = '#' + gameId + ',' + playerColor;
   window.location.hash = hash;
   currentGameId = gameId;
   console.log('joined ' + gameId + ' as player ' + playerColor)
   if(playerColor == 'blue' && (currentControl == 'inactive' || currentControl == 'court')){
     switchToMultiDevice('blue');
   }
 }

 function handleNewPlayer(){
   //This only gets called for player1
   if(currentControl == 'inactive'){
     switchToMultiDevice('red');
   }
 }

 function switchToMultiDevice(_devicePlayerColor){
   numberDevices = 2;
   devicePlayerColor = _devicePlayerColor;
   console.log('running in 2 device mode');
 }

 function updateOtherDeviceWorld({discs, cue}){
   socket.emit('update-world', {
     gameId: currentGameId,
     discs: discs.map(d => {
       return {
         position: d.body.position,
         velocity: d.body.velocity,
         visible: d.mesh.visible
       }
     }),
     cue: {position: cue.body.position},
     playerColor: devicePlayerColor,
   })
 }

 function updateOtherDeviceGame( data ){
   //TODO
   socket.emit('update-game', {...data, playerColor: devicePlayerColor, gameId: currentGameId})
 }

 function handleUpdateGame( data ){
   //TODO -- handle update for disc thrown, throw over, turn over, etc
   if(devicePlayerColor == data.playerColor) return
   if( data.event == 'startGame'){
     rendererComponent.startGame();
   }else if (data.event == 'throwOver'){
     rendererComponent.handleThrowOver();
   }else if (data.event == 'thrownDisc'){
     rendererComponent.handleThrownDisc();
   }else if( data.event == 'roundOver'){
     //TODO - need separate function to sync on round over
     rendererComponent.handleRoundOver();
   }else if( data.event == 'gameOver' ){
     //TODO - need separate function to sync on game over
     //rendererComponent.handleRoundOver();
   }
 }

 function handleUpdateWorld( data ){
   if(devicePlayerColor == data.playerColor) return
   rendererComponent.updateGameFromData( data );
 }


 if(DEV_MODE){
   //Overlay doesn't work on webxr emulator, so expose function on window for development
   window.handleChangeControls = handleChangeControls;
   window.handleUpdateScore = handleUpdateScore
   window.handleGameOver = handleGameOver
   window.updateValue = handleUpdateValueFromOverlay
   window.handleUpdateScore = handleUpdateScore;
 }
  
</script>

<style>
 main {
     text-align: center;
     padding: 1em;

     margin: 0 auto;
     max-height: 95vh;
     overflow: hidden;
 }

</style>

<main>
  <div bind:this={overlayContainer} class="overlay-container">
    <Overlay  {sessionActive} {currentControl} {rendererComponent} {gameScore} {winningPlayer}
              {gameScale} {numDiscs} {numberDevices} {showContinueButton} textState={overlayTextState}
              {discInPlay}
              {DEV_MODE} {DEBUG_MODE}
              on:startClick={handleStartClick}
              on:endClick={handleEndClick}              
              on:changeControls={handleChangeControls}
              on:updateValue={handleUpdateValueFromOverlay}
              on:continueClick={handleContinueClick}
              bind:this={overlayComponent}
    />
  </div>
  <ARRenderer bind:this={rendererComponent} {overlayContainer} {currentControl} {overlayComponent} {gameScore}
              {gameScale} {numDiscs} {numberDevices} {devicePlayerColor} {updateOtherDeviceWorld} {updateOtherDeviceGame}
              {DEV_MODE} {DEBUG_MODE}
              on:appLoaded={initApp}
              on:changeControls={handleChangeControls}
              on:updateScore={handleUpdateScore}
              on:gameOver={handleGameOver}
              on:startGame={handleStartGame}
              on:startRound={handleStartRound}
              on:switchPlayers={handleSwitchPlayers}
              on:resetCourt={handleResetCourt}
              on:updateDiscInPlayStatus={handleDiscInPlayStatus}
              on:planeDetectionStateUpdate={handlePlaneDetectionStateUpdate}
              on:courtSet={handleCourtSet}
              on:setScore={handleSetScore}
  />

</main>


