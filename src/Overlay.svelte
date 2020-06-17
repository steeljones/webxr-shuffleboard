<script>
 export let sessionActive;
 export let currentControl;
 export let rendererComponent;
 export let textState;
 export let winningPlayer;
 export let gameScore;
 export let gameScale;
 export let numDiscs;
 export let numberDevices;
 export let showContinueButton;
 export let discInPlay;

 export let DEV_MODE;
 export let DEBUG_MODE;

 import axios from 'axios';
 import { createEventDispatcher } from 'svelte';
 import * as dat from 'dat.gui';
 
 const dispatch = createEventDispatcher();

 let debugItems = {
 };
 
 let touchStartPoint = {x: 0, y:0};

  let controlsOpen = false;

 let currentPlayer;
 let messageText;
 let instructionsText;

 //Score to display -- gets incremented when gameScore changes to animate in points being added
 let displayScore = {red: 0, blue: 0}

 let debugCanvas,
     debugContainer,
     gui;

 let displayText = {
   roundOver: { message: 'Round Over', instructions: 'Move to other end of court'},
   tapToPlayAgain: { instructions: 'Tap to play again'},
   clear: {message: '', instructions: ''},
   switchPlayers: {message: '', instructions: () => `${currentPlayer == 'red' ? 'blue' : 'red'} player's turn`},
   gameOver: {message: () => `WINNER: ${winningPlayer.toUpperCase()}`},
   setCourt: {message: '', instructions: 'Tap to place court'},
   tapToStart: {message: '', instructions: 'Tap to start game'},
   movePhone: {message: '', instructions: 'Move phone slowly until court appears'}
 }

 if(DEBUG_MODE){
   initDatGui();
 }

 //Watchers
 $: {
   //Increment the displayScore in
   if(displayScore.red < gameScore.red){
     setTimeout(() => {
       displayScore.red++;
     }, 20)
   }
   if(displayScore.blue < gameScore.blue){
     setTimeout(() => {
       displayScore.blue++;
     }, 20)
   }
 }

 $: {
   //Update the message text and instructions text based on the textState prop
   let textToDisplay = displayText[textState];
   updateDisplayText(textToDisplay);
 }

  function handleARButtonClick(){
   if(!sessionActive){
     dispatch('startClick', {});
   }else{
     dispatch('endClick', {});
   }
 }

 function changeControls(controlType){
   rendererComponent.lockUIForATick();
   dispatch('changeControls', {controlType});
 }

 export function renderDebug(rendererDebugItems){
   debugItems = rendererDebugItems;
 }

 function handleOverlayClick(){
   //console.log('overlay click')
 }
 
 function handleOverlayTouchStart(event){
   if(currentControl == 'expand'){
     let {pageX, pageY} = event.targetTouches[0];
     touchStartPoint = { x: pageX, y: pageY };
   }
 }
 
 function handleOverlayTouchMove(event){
   if(currentControl == 'expand'){
     let { pageX, pageY } = event.targetTouches[0];
     let deltaX = pageX - touchStartPoint.x;
     let deltaY = touchStartPoint.y - pageY;
     rendererComponent.handleExpandTouchMove(deltaX, deltaY)
   }
 }
 
 function handleOverlayTouchEnd(event){
   if(currentControl == 'expand'){
     rendererComponent.handleExpandTouchEnd();
   }
 }

 function initDatGui(){
   gui = new dat.GUI({autoPlace: false});
   let values = {gameScale, numDiscs};
   let scaleController = gui.add(values, 'gameScale', .1, 1.0);
   let numDiscsController = gui.add(values, 'numDiscs', 2, 32, 2);
   //scaleController.onChange(handleValueChange)
   scaleController.onFinishChange(handleValueChange)
   numDiscsController.onFinishChange(handleValueChange)

   gui.domElement.style.zIndex = 1000;
   gui.domElement.style.height = '80px';
   setTimeout( () => {
     //Move gui to overlay
     debugContainer.prepend(gui.domElement);
   }, 1 );
 }

 function handleValueChange(value){
   let data = {};
   data[this.property] = value;
   dispatch('updateValue', data);
   rendererComponent.lockUIForATick();
 }

 function handleApplyForceClick(forceArray = [1,1]){
   rendererComponent.applyForceToThrownDisc(forceArray);
   rendererComponent.lockUIForATick();
 }

 function handleContinueClick(){
   rendererComponent.lockUIForATick();
   dispatch('continueClick', {})
 }

 function toggleControls(){
   rendererComponent.lockUIForATick();
   controlsOpen = !controlsOpen;
 }

 export function setCurrentPlayer(player){
   currentPlayer = player;
 }

 function updateDisplayText(textToDisplay){
   if(textToDisplay.message){
     if(typeof textToDisplay.message == 'function' ){
       messageText = textToDisplay.message();
     }else {
       messageText = textToDisplay.message;
     }
   }else if(textToDisplay.message !== undefined){
     messageText = ''
   }

   if(textToDisplay.instructions){
     if(typeof textToDisplay.instructions == 'function' ){
       instructionsText = textToDisplay.instructions();
     }else{
       instructionsText = textToDisplay.instructions;
     }
   }else if(textToDisplay.instructions !== undefined){
     instructionsText = '';
   }
 }

 function handleSaveClick(){
   rendererComponent.lockUIForATick();
   rendererComponent.saveGame();
 }

 function handleLoadClick(){
   rendererComponent.lockUIForATick();
   rendererComponent.loadGame();
 }

 export function reset(){
   displayScore.red = 0;
   displayScore.blue = 0;
 }


 </script>

<div class="overlay" on:click={handleOverlayClick}
     on:touchstart|self={handleOverlayTouchStart}
     on:touchmove={handleOverlayTouchMove}
     on:touchend={handleOverlayTouchEnd}
     
>
  {#if sessionActive}
  <div class="score" class:debug="{DEBUG_MODE}">
    <div>
      Red: {displayScore.red}
    </div>

    <div>
      Blue: {displayScore.blue}
    </div>
  </div>
  <div class="{messageText ? 'message' : 'hidden message'}">
    { messageText }
  </div>
  <div class="{instructionsText ? 'instructions' : 'hidden instructions'}">
    { instructionsText }
  </div>

  <div class="inplay-container" class:hidden={!discInPlay}>
    <button class="up" on:click="{handleApplyForceClick.bind(this, [0, 1])}">
      &#8593;
    </button>
    <button class="left" on:click="{handleApplyForceClick.bind(this, [-1, 0])}">
      &#8592;
    </button>
    <button class="right" on:click="{handleApplyForceClick.bind(this, [1, 0])}">
      &#8594;
    </button>
    <button class="down" on:click="{handleApplyForceClick.bind(this, [0, -1])}">
      &#8595;
    </button>
  </div>

  <div class="controls-container">
    <button class="open" on:click="{toggleControls}" disabled="{showContinueButton || discInPlay}">^</button>
    <div class="controls" class:hidden="{!controlsOpen}">
      <button on:click="{changeControls.bind(this, 'resetCourt')}" class="reset-court">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="map-pin" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 512" class="svg-inline--fa fa-map-pin fa-w-9 fa-3x"><path fill="currentColor" d="M112 316.94v156.69l22.02 33.02c4.75 7.12 15.22 7.12 19.97 0L176 473.63V316.94c-10.39 1.92-21.06 3.06-32 3.06s-21.61-1.14-32-3.06zM144 0C64.47 0 0 64.47 0 144s64.47 144 144 144 144-64.47 144-144S223.53 0 144 0zm0 76c-37.5 0-68 30.5-68 68 0 6.62-5.38 12-12 12s-12-5.38-12-12c0-50.73 41.28-92 92-92 6.62 0 12 5.38 12 12s-5.38 12-12 12z" class=""></path></svg>
      </button>

      <button on:click="{changeControls.bind(this, 'changeScale')}" class="change-scale">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="expand" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="svg-inline--fa fa-expand fa-w-14 fa-2x"><path fill="currentColor" d="M0 180V56c0-13.3 10.7-24 24-24h124c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H64v84c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12zM288 44v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V56c0-13.3-10.7-24-24-24H300c-6.6 0-12 5.4-12 12zm148 276h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24V332c0-6.6-5.4-12-12-12zM160 468v-40c0-6.6-5.4-12-12-12H64v-84c0-6.6-5.4-12-12-12H12c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12z" class=""></path></svg>
      </button>

      <button on:click="{handleSaveClick}" class="save-game" disabled="{currentControl != 'throw'}">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="save" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="svg-inline--fa fa-save fa-w-14 fa-3x"><path fill="currentColor" d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z" class=""></path></svg>
      </button>

      <button on:click="{handleLoadClick}" class="load-game">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="file" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="svg-inline--fa fa-file fa-w-12 fa-2x"><path fill="currentColor" d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm160-14.1v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z" class=""></path></svg>
      </button>
    </div>
  </div>

  <button class="continue" class:hidden="{!showContinueButton}"
          on:click="{handleContinueClick}"
  >
    Continue
  </button>

  {/if}
  {#if DEBUG_MODE}
  <div class="debug-container"
       bind:this={debugContainer}
  >
    {#each Object.entries(debugItems) as [key, value]}
    <div class="debug-item">
      {key + ': ' + value}
    </div>
    {/each}

    <div bind:this={debugCanvas}></div>
  </div>
  {/if}
  <button class="ar-button" on:click="{handleARButtonClick}">{sessionActive ? 'END AR' : 'START AR'}</button>
</div>  


<style>
 .ar-button {
     position: fixed;
     bottom: 20px;
     cursor: pointer;
     left: calc(50% - 80px);
     width: 160px;
     opacity: 0.8;
     padding: 12px 6px;
     border: 1px solid #fff;
     border-radius: 4px;
     background: rgba(0, 0, 0, 0.1);
     color: #fff;
     font: normal 13px sans-serif;
     outline: none;
     z-index: 999;
 }

 .ar-button:hover {
     opacity: 1.0;
 }
  .debug-container{
     position: absolute;
     z-index: 999;
     right: 0;
     top: 0;
     background-color: rgba(0, 0, 0, 0.3);
     color: red;
     padding-bottom: 5px;
     font-family: monospace;
     font-size: 11px;
     border-radius: 0px 0px 0px 5px;
 }
 button svg{
     height: 35px;
     width: 35px;
 }
 .overlay {
     width:100vw;
     height:95vh;
     top: 0;
     left: 0;
     position: absolute;
 }
 .message {
     pointer-events: none;
     color: red;
     font-size: 36px;
     font-family: monospace;
     width: 100vw;
     position: fixed;
     top: 42vh;
     text-align: center;
     text-transform: uppercase;
 }
 .instructions {
     pointer-events: none;
     color: red;
     font-size: 30px;
     font-family: monospace;
     width: 100vw;
     position: fixed;
     top: 54vh;
     text-align: center;
 }
 .hidden{
     opacity: 0;
     pointer-events: none;
 }
 .debug.score {
     margin-left: 0vw;
 }
 .score {
     font-family: monospace;
     text-transform: uppercase;
     font-size: 24px;
     font-weight: bold;
     color: red;
     background: rgba(0, 0, 0, 0.5);
     border-bottom-left-radius: 8px;
     border-bottom-right-radius: 8px;
     width: 40vw;
     margin-left: 30vw;
     padding: 8px;
 }
 .inplay-container button {
     position: fixed;
     width: 60px;
     height: 60px;
     opacity: 0.5;
     border-radius: 4px;
 }
 .inplay-container button.up{
     top: 15vh;
     left: calc(50vw - 30px);
 }
 .inplay-container button.down{
     bottom: 15vh;
     left: calc(50vw - 30px);
 }
 .inplay-container button.left{
     top: calc(50vh - 30px);
     left: 4vh;
 }
 .inplay-container button.right{
     top: calc(50vh - 30px);
     right: 4vh;
 }

 button.continue {
     position: fixed;
     top: 62vh;
     left: calc(50vw - 100px);
     width: 200px;
     height: 50px;
     border-radius: 4px;
     text-transform: uppercase;
     font-weight: bold;
     font-size: 28px;
     line-height: 28px;
 }
 .controls-container {
     position: fixed;
     left: 20px;
     bottom: 20px;
     display: flex;
     flex-wrap: wrap-reverse;
     flex-direction: column-reverse;
 }
 .controls-container button.open{

 }
 .controls-container button {
     margin: 10px auto;
     width: 40px;
     height: 40px;
 }
 .controls-container button svg{
     width: 25px;
     height: 25px;
 }
 .controls {
     display: flex;
     flex-direction: column;
 }
 button:disabled {
     opacity: .3;
 }
</style>  



