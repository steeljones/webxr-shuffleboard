<script>
 export let sessionActive;
 export let currentControl;
 export let rendererComponent;
 export let messageText;
 export let instructionsText;
 export let gameScore;
 export let gameScale;
 export let numDiscs;
 export let numberDevices;
 export let showContinueButton;

 export let DEV_MODE;
 export let DEBUG_MODE;

 import axios from 'axios';
 import { createEventDispatcher } from 'svelte';
 import * as dat from 'dat.gui';
 
 const dispatch = createEventDispatcher();

 let debugItems = {
 };
 
 let touchStartPoint = {x: 0, y:0};

 let displayDiscControls = false;
 let controlsOpen = false;

 //Score to display -- gets incremented when gameScore changes to animate in points being added
 let displayScore = {red: 0, blue: 0}

 let debugCanvas,
     debugContainer,
     gui;

 if(DEBUG_MODE){
   initDatGui();
 }

 //Watchers
 $: {
   //Increment the displayScore in
   if(displayScore.red < gameScore.red){
     setTimeout(() => {
       displayScore.red++;
     }, 50)
   }else if(displayScore.blue < gameScore.blue){
     setTimeout(() => {
       displayScore.blue++;
     }, 50)
   }
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

 export function setDiscControlDisplayState(displayState){
   displayDiscControls = displayState;
 }

 function handleContinueClick(){
   rendererComponent.lockUIForATick();
   dispatch('continueClick', {})
 }

 function toggleControls(){
   rendererComponent.lockUIForATick();
   controlsOpen = !controlsOpen;
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

  <div class="inplay-container" class:hidden={!displayDiscControls}>
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
    <button class="open" on:click="{toggleControls}">^</button>
    <div class="controls" class:hidden="{!controlsOpen}">
      <button on:click="{changeControls.bind(this, 'resetCourt')}" class="reset-court">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="map-pin" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 512" class="svg-inline--fa fa-map-pin fa-w-9 fa-3x"><path fill="currentColor" d="M112 316.94v156.69l22.02 33.02c4.75 7.12 15.22 7.12 19.97 0L176 473.63V316.94c-10.39 1.92-21.06 3.06-32 3.06s-21.61-1.14-32-3.06zM144 0C64.47 0 0 64.47 0 144s64.47 144 144 144 144-64.47 144-144S223.53 0 144 0zm0 76c-37.5 0-68 30.5-68 68 0 6.62-5.38 12-12 12s-12-5.38-12-12c0-50.73 41.28-92 92-92 6.62 0 12 5.38 12 12s-5.38 12-12 12z" class=""></path></svg>
      </button>

      <button on:click="{changeControls.bind(this, 'changeScale')}" class="change-scale">
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="expand" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="svg-inline--fa fa-expand fa-w-14 fa-2x"><path fill="currentColor" d="M0 180V56c0-13.3 10.7-24 24-24h124c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H64v84c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12zM288 44v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V56c0-13.3-10.7-24-24-24H300c-6.6 0-12 5.4-12 12zm148 276h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24V332c0-6.6-5.4-12-12-12zM160 468v-40c0-6.6-5.4-12-12-12H64v-84c0-6.6-5.4-12-12-12H12c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12z" class=""></path></svg>
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
</style>  



