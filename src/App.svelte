

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

 let gameScore = { red: 0, blue: 0 };
 
 let messageText = '';
 let instructionsText = '';

 //Variables set in dat.gui that then get passed to renderer
 let gameScale = DEV_MODE ? 1 / 2 : 1 / 3;
 let numDiscs = 2;

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
     currentControl = controlType;
   }else{
     //Move to next control in the list
     let currentIdx = controls.indexOf(currentControl);
     currentControl = controls[++currentIdx % controls.length];
   }
   console.log('control: ', controlType)
 }

 function handleUpdateScore({detail}){
   let {color, value} = detail
 
   gameScore[color] += value;
   //gameScore = gameScore;
   console.log(gameScore)
 }

 function handleGameOver({detail}){
   let { winner } = detail;
   messageText = 'Winner: ' + winner;
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

 function handleUpdateValueFromOverlay({detail}){
   let [key, value] = Object.entries(detail)[0];
   if(key == 'gameScale'){
     gameScale = value;
   }else if(key == 'numDiscs'){
     numDiscs = value;
   }
 }
 
 //Overlay doesn't work on webxr emulator, so expose function on window for development
 window.handleChangeControls = handleChangeControls;
 window.hus = handleUpdateScore
 window.hgo = handleGameOver
 window.updateValue = handleUpdateValueFromOverlay
  
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
              {gameScale} {numDiscs}
              {DEV_MODE} {DEBUG_MODE}
              on:startClick={handleStartClick}
              on:endClick={handleEndClick}              
              on:changeControls={handleChangeControls}
              on:updateValue={handleUpdateValueFromOverlay}
              bind:this={overlayComponent}
    />
  </div>
  <ARRenderer bind:this={rendererComponent} {overlayContainer} {currentControl} {overlayComponent} {gameScore}
              {gameScale} {numDiscs}
              {DEV_MODE} {DEBUG_MODE}
              on:appLoaded={initApp}
              on:changeControls={handleChangeControls}
              on:updateScore={handleUpdateScore}
              on:gameOver={handleGameOver}
              on:startGame={handleStartGame}
  />

</main>


