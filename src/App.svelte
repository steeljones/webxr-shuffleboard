

<script>
 import Overlay from './Overlay.svelte';
 import ARRenderer from './ARRenderer.svelte'; 


 let overlayComponent, rendererComponent, overlayContainer;

 let arReady = false;
 let appReady = false;
 let sessionActive = window.location.search == '?overlay' ? true : false;
 //let sessionActive = true;

 let controls = ['court', 'throw']
 let currentControl = 'court';

 let gameScore = { red: 0, blue: 0 };
 window.gameScore = gameScore

 let messageText = '';

 $:showOverlay = arReady && appReady;
 let showDebug = true;

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
 }
 
 //Overlay doesn't work on webxr emulator, so expose function on window for development
 window.handleChangeControls = handleChangeControls;
 window.hus = handleUpdateScore
  
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
    <Overlay  {sessionActive} {currentControl} {rendererComponent} {showDebug} {gameScore} {messageText}
              on:startClick={handleStartClick}
              on:endClick={handleEndClick}              
              on:changeControls={handleChangeControls}
              bind:this={overlayComponent}
    />
  </div>
  <ARRenderer bind:this={rendererComponent} {overlayContainer} {currentControl} {overlayComponent} {gameScore}
              {showDebug} on:appLoaded={initApp}
              on:changeControls={handleChangeControls}
              on:updateScore={handleUpdateScore}
              on:gameOver={handleGameOver}
  />

</main>


