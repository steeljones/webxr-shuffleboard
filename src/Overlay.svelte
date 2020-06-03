<script>
 export let sessionActive;
 export let currentControl;
 export let rendererComponent;
 export let showDebug;
 export let messageText;

 export let gameScore;

 import axios from 'axios';
 import { createEventDispatcher } from 'svelte';
 const dispatch = createEventDispatcher();

 const serverURL = window.location.protocol == 'http'
                 ? window.location.origin.replace(window.location.port, 3000)
                 : 'https://' + window.location.hostname + ':3001';
 const serverSaveURL = serverURL + '/saveScene'
 const serverLoadURL = serverURL + '/scene'

 let debugItems = {};
 let showMessage = false;


 let touchStartPoint = {x: 0, y:0};

 let matterDebugCanvas;
 
 export function getMatterDebugCanvas(){
   return matterDebugCanvas;
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
 
</script>

<div class="overlay" on:click={handleOverlayClick}
     on:touchstart|self={handleOverlayTouchStart}
     on:touchmove={handleOverlayTouchMove}
     on:touchend={handleOverlayTouchEnd}>
  {#if sessionActive}
  <div class="score">
    <div>
      Red: {gameScore.red}
    </div>

    <div>
      Blue: {gameScore.blue}
    </div>
  </div>
  <div class="{showMessage ? 'message' : 'hidden message'}">
    { messageText }
  </div>

  {/if}
  {#if showDebug}
  <div class="debug-container">
    {#each Object.entries(debugItems) as [key, value]}
    <div class="debug-item">
      {key + ': ' + value}
    </div>
    {/each}

    <div bind:this={matterDebugCanvas}></div>
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
     padding: 5px;
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
     font-size: 24px;
     font-family: monospace;
     width: 100px;
     position: fixed;
     top: 48vh;
     left: calc(50vw - 50px);
 }
 .hidden{
     opacity: 0;
     pointer-events: none;
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
</style>  



