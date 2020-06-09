<script>
 export let sessionActive;
 export let currentControl;
 export let rendererComponent;
 export let messageText;
 export let instructionsText;
 export let gameScore;
 export let gameScale;
 export let numDiscs;
 export let numberPlayers;
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

 let displayDiscControls = true;

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
   let numDiscsController = gui.add(values, 'numDiscs', 2, 32, 1);
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

</script>

<div class="overlay" on:click={handleOverlayClick}
     on:touchstart|self={handleOverlayTouchStart}
     on:touchmove={handleOverlayTouchMove}
     on:touchend={handleOverlayTouchEnd}
     
>
  {#if sessionActive}
  <div class="{DEBUG_MODE ? 'debug score' : 'score'}">
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
</style>  



