<script>
 export let sessionActive;
 export let currentControl;
 export let rendererComponent;
 export let showDebug;

 import axios from 'axios';
 import { createEventDispatcher } from 'svelte';
 const dispatch = createEventDispatcher();

 const serverURL = window.location.protocol == 'http'
                 ? window.location.origin.replace(window.location.port, 3000)
                 : 'https://' + window.location.hostname + ':3001';
 const serverSaveURL = serverURL + '/saveScene'
 const serverLoadURL = serverURL + '/scene'

 let debugItems = {};
 let showConfirmation = false;
 let confirmationText = '';

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

 function handleSaveClick(){
   confirmationText = 'saving...';
   showConfirmation = true;
   
   rendererComponent.lockUIForATick();
   let data = rendererComponent.getSceneAsJSON();
   axios.post(serverSaveURL, {data})
        .then(response => {
          console.log(response.data);
          confirmationText = 'saved!'
          setTimeout( () => {
            showConfirmation = false;
            confirmationText = '';
          }, 500 );
        })
        .catch(error => {
          console.log(error);
        });
 }

 async function handleLoadClick(){
   confirmationText = 'loading...';
   showConfirmation = true;
   rendererComponent.lockUIForATick();
   let response = await axios.get(serverLoadURL);
   let { data } = response;

   rendererComponent.loadSceneFromData( data );
   confirmationText = 'loaded!';
   setTimeout( () => {
     showConfirmation = false;
     confirmationText = '';
   }, 500 );
 }

 window.save = handleSaveClick;
 window.load = handleLoadClick;
 
</script>

<div class="overlay" on:click={handleOverlayClick}
     on:touchstart|self={handleOverlayTouchStart}
     on:touchmove={handleOverlayTouchMove}
     on:touchend={handleOverlayTouchEnd}>
  {#if sessionActive}
  <!--div class="scene-controls">
    <button on:click|stopPropagation="{changeControls.bind(this,'plane')}" class="{currentControl == 'plane' ? 'active' : ''}" >▼</button>
    <button on:click|stopPropagation="{changeControls.bind(this,'block')}" class="{currentControl == 'block' ? 'active' : ''}" >■</button>
    <button on:click|stopPropagation="{changeControls.bind(this, 'ball')}" class="{currentControl == 'ball' ? 'active' : ''}" >●</button>
    <button on:click|stopPropagation="{changeControls.bind(this, 'expand')}" class="{currentControl == 'expand' ? 'active' : ''}" ><svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="expand" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="svg-inline--fa fa-expand fa-w-14 fa-2x"><path fill="currentColor" d="M0 180V56c0-13.3 10.7-24 24-24h124c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H64v84c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12zM288 44v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V56c0-13.3-10.7-24-24-24H300c-6.6 0-12 5.4-12 12zm148 276h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24V332c0-6.6-5.4-12-12-12zM160 468v-40c0-6.6-5.4-12-12-12H64v-84c0-6.6-5.4-12-12-12H12c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12z" class=""></path></svg></button>
    <button on:click|stopPropagation="{changeControls.bind(this,'anchor')}" class="{currentControl == 'anchor' ? 'active' : ''}" >
      <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="map-pin" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 512" class="svg-inline--fa fa-map-pin fa-w-9 fa-3x"><path fill="currentColor" d="M112 316.94v156.69l22.02 33.02c4.75 7.12 15.22 7.12 19.97 0L176 473.63V316.94c-10.39 1.92-21.06 3.06-32 3.06s-21.61-1.14-32-3.06zM144 0C64.47 0 0 64.47 0 144s64.47 144 144 144 144-64.47 144-144S223.53 0 144 0zm0 76c-37.5 0-68 30.5-68 68 0 6.62-5.38 12-12 12s-12-5.38-12-12c0-50.73 41.28-92 92-92 6.62 0 12 5.38 12 12s-5.38 12-12 12z" class=""></path></svg>
    </button>
    
    <button on:click|stopPropagation="{handleSaveClick}">
      <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="save" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="svg-inline--fa fa-save fa-w-14 fa-3x"><path fill="currentColor" d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z" class=""></path></svg>
    </button>
    <button on:click|stopPropagation="{handleLoadClick}">
      <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="file" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="svg-inline--fa fa-file fa-w-12 fa-2x"><path fill="currentColor" d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm160-14.1v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z" class=""></path></svg>
    </button>

  </div-->
  <div class="{showConfirmation ? 'confirmation' : 'hidden confirmation'}">
    { confirmationText }
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
 .scene-controls {
     z-index: 999;
     position: absolute;
     left: 0;
     bottom: 15vh;
     height: 70vh;
     display: flex;
     flex-direction: column;
     width: 60px;
     align-items: center;
 }
 .scene-controls > button{
     margin: auto auto;
     
     opacity: 0.6;
     width: 50px;
     height: 50px;
     justify-content: center;
     border-radius: 4px;
     color: rgb(255, 0, 255);
     background-color: white;
 }
 .scene-controls > button.active{
     background-color: rgb(255, 0, 255);
     color: white;
     transform: scale(1.1);
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
 .confirmation {
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
</style>  



