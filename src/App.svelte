

<script>
 import Overlay from './Overlay.svelte';
 import ARRenderer from './ARRenderer.svelte';

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

 let gameScore = { red: 0, blue: 0 };
 window.gameScore = gameScore

 let numberDevices = 1;
 
 let messageText = '';
 let instructionsText = '';
 let showContinueButton = false;

 //Variables set in dat.gui that then get passed to renderer
 let gameScale = DEV_MODE ? 1 / 2 : 1 / 2;
 let numDiscs = 8;

 $:showOverlay = arReady && appReady;

 $: {
   //console.log('Current control changed: ', currentControl)
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
   console.log('control: ', controlType)
 }

 function handleRevertControls(detail = {}){
   currentControl = lastControl;
   console.log('revert control: ', controlType)
 }

 function handleUpdateScore({detail}){
   let {color, value, gameOver} = detail

   if(value > 0){
     //TODO - play sound effect
     gameScore[color] += value;     
   }
   if(!gameOver){
     messageText = 'Round Over'
     instructionsText = 'Move to other end of court';
   }
 }

 function handleGameOver({detail}){
   let { winner } = detail;
   messageText = 'WINNER: ' + winner.toUpperCase();
   console.log('GAME WON: ', winner);
   setTimeout( enableTapToPlayAgain, 4000 );
 }

 function enableTapToPlayAgain(){
   instructionsText = 'Tap to play again';
   currentControl = 'inactive';
 }

 function handleStartGame(){
   gameScore.red = 0;
   gameScore.blue = 0;
   currentControl = 'throw';
   messageText = '';
   instructionsText = '';
 }

 function handleStartRound(){
   messageText = '';
   instructionsText = '';
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
     instructionsText = nextPlayer + ' player\'s turn';
     setTimeout( () => {
       showContinueButton = true;
     }, 500 );
   }
 }

 function handleContinueClick({detail}){
   if(currentControl == 'switchingPlayers'){
     instructionsText = '';
     showContinueButton = false;
     rendererComponent.moveOnToNextTurn();
   }
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
    <Overlay  {sessionActive} {currentControl} {rendererComponent} {gameScore} {messageText} {instructionsText}
              {gameScale} {numDiscs} {numberDevices} {showContinueButton}
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
              {gameScale} {numDiscs} {numberDevices}
              {DEV_MODE} {DEBUG_MODE}
              on:appLoaded={initApp}
              on:changeControls={handleChangeControls}
              on:updateScore={handleUpdateScore}
              on:gameOver={handleGameOver}
              on:startGame={handleStartGame}
              on:startRound={handleStartRound}
              on:switchPlayers={handleSwitchPlayers}
              on:revertControls={handleRevertControls}
  />

</main>


