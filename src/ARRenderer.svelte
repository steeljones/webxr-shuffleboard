<script>
 export let overlayComponent;
 export let overlayContainer;
 export let currentControl;
 export let gameScore;
 export let gameScale;
 export let numDiscs;
 export let numberDevices;
 export let devicePlayerColor;
 
 export let DEV_MODE;
 export let DEBUG_MODE;
  
 import * as THREE from 'three';
 import { Body, World, Circle, Box, ContactMaterial, Material, vec2 } from "p2";
 import Stats from 'stats-js';
 import axios from 'axios';
 import { createEventDispatcher, onMount, tick } from 'svelte';
 import Cue from './Cue';
 import Court from './Court';
 import Disc from './Disc';
 import { SCORINGAREAS, BOUNDS, REDCUE, BLUECUE, REDDISCS, BLUEDISCS } from './collisionConstants';

 const dispatch = createEventDispatcher();

 const serverURL = window.location.protocol == 'http:'
                 ? window.location.origin.replace(window.location.port, 3000)
                 : 'https://' + window.location.hostname + ':3001';
 const serverSaveURL = serverURL + '/saveGame'
 const serverLoadURL = serverURL + '/game'

 //Variables for app created three / p2 objects
 let canvas, camera, scene, renderer,
     controller,
     reticle,
     raycaster,
     screenCenter = new THREE.Vector2(),
     mouse = new THREE.Vector2(),
     anchor,
     court,
     discs = [],
     cue,
     showCue = false,
     reticleNullBody,
     reticleNullBody2;

 //Webxr variables
 let hitTestSource = null;
 let hitTestSourceRequested = false;
 let currentSession;

 //Variables for three/p2 objects
 let clock,
     courtOpacity = 0.5,
     world,
     courtSet = false,
     fixedTimeStep = 1 / 60,
     maxSubSteps = 10;

 //Params that get changed from dat.gui
 let courtWidth = 1.5 * gameScale;
 let courtLength = 9.1 * gameScale;
 let discRadius = .1 * gameScale;
 let discMass = .425 * gameScale;//kg - not sure if it should be changed to grams
 let cueWidth = discRadius * 6;
 let cueHeight = discRadius / 4;
 let cueDepth = discRadius / 2;
 let devModeCueOffset = -courtLength * .425;
 
 //p2/three parameter variables
 let anchorHeight = .2;
 let courtHeight = .02;
 let discHeight = .01;
 let discRestitution = 0.5;
 let discDamping = 0.4
  

 //Game state / game scoring variables
 let currentPlayer = 'open';
 let currentTurnNumber;
 //Number of points to win
 let scoreThreshold = 21;
 //Variable to control which side of court is in play - 
 let oppositeSideInPlay = false;
 let planeDetected = false;
 
 let lockUI = false;

  //Debug info/stats
 let stats;
 let debugInfo = {};

 //Watchers
 $: {
   //gameScale watcher
   gameScale = gameScale;
   handleGameScaleChange();
 }

 $:{
   if(currentControl == 'resetCourt'){
     courtSet = false;
     for(let d of discs){
       d.mesh.visible = false;
     }
   }
 }

 init();
 
 function init(){
   initP2Physics();
   initScene();
   initCourt();
   renderer.setAnimationLoop( render );
   dispatch('appLoaded', {});
   
   if(DEBUG_MODE){
     setTimeout  ( () => initStats, 500 );
   }

   if(DEV_MODE){
     initDevKeyListeners();
   }
 }

 export function startSession(){
   let sessionInit = { requiredFeatures: [ 'hit-test' ],
                       optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar'],
                       domOverlay: {root: overlayContainer}
   };
   navigator.xr.requestSession( 'immersive-ar', sessionInit ).then( handleSessionStart );
 }

 export function endSession(){
   currentSession.end();
 }

 function handleSessionStart(session){
   session.addEventListener( 'end', handleSessionEnd );
   renderer.xr.setReferenceSpaceType( 'local' );
   renderer.xr.setSession( session );
   currentSession = session;
 }

 function handleSessionEnd(){
   currentSession.removeEventListener( 'end', handleSessionEnd );
   currentSession = null;
 }
 

 function initScene() {
   clock = new THREE.Clock();
   
   scene = new THREE.Scene();
   camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );

   var light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
   light.position.set( 0.5, 1, 0.25 );
   scene.add( light );

   renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, canvas  } );
   renderer.setPixelRatio( window.devicePixelRatio );
   renderer.setSize( window.innerWidth, window.innerHeight );
   renderer.xr.enabled = true;

   controller = renderer.xr.getController( 0 );
   controller.addEventListener( 'select', handleSelect );
   
   scene.add( controller );

   let reticleTexture = new THREE.TextureLoader().load( "reticle-arrow.png" );

   reticle = new THREE.Mesh(
     new THREE.PlaneBufferGeometry(.2, .2).rotateX( - Math.PI / 2),
     new THREE.MeshBasicMaterial({map: reticleTexture, transparent: true, depthTest: false, opacity: 0.5})
   );
   reticle.renderOrder = 1;
   reticle.matrixAutoUpdate = false;
   reticle.visible = false;
   scene.add( reticle );

   raycaster = new THREE.Raycaster();

   window.addEventListener( 'resize', onWindowResize, false );

   //Init anchor
   let spriteMap = new THREE.TextureLoader().load( "pin.svg" );
   let spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, opacity: 0.7, transparent: true } );
   anchor = new THREE.Sprite( spriteMaterial );
   anchor.scale.set(anchorHeight / 2, anchorHeight, .1)
   anchor.visible = false;
   scene.add( anchor );

   window.reticle = reticle;
 }

 function handleSelect(event) {
   if(lockUI) return

   switch ( currentControl ){
     case 'court':
       if ( reticle.visible) {
         initDiscs();
         setCourt();
         setDiscs();
         initCue();
         reticle.material.opacity = .1;
       }
       break;
     case 'inactive':
       startGame();
       break;
     case 'throw':
       if(DEV_MODE && discs[ currentTurnNumber ].status != 'inplay'){
         throwCurrentDisc();
       }else if( discs[ currentTurnNumber ].status != 'inplay'){
         //Reset the current disc
         discs[ currentTurnNumber ].reset(court.length, oppositeSideInPlay, true)
       }else{
         applyForceToThrownDisc([-1, -1])
       }
       break;
     case 'switchingPlayers':
       //Don't allow any interactions when handing over the device to next player
       break;
     case 'resetCourt':
       resetCourt();
       break;
   }
 }

 function initP2Physics(){
   world = new World({
     gravity:[0, 0]
   });

   world.sleepMode = World.BODY_SLEEPING;
   world.defaultContactMaterial.friction = .01;
 }

 function render( timestamp, frame ) {
   if( stats ){
     stats.begin();
   }

   if ( frame ) {
     let referenceSpace = renderer.xr.getReferenceSpace();
     let session = renderer.xr.getSession();

     if ( hitTestSourceRequested === false ) {
       session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {
	 session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {
	   hitTestSource = source;
	 } );
       } );
/*
       session.addEventListener( 'end', function () {

	 hitTestSourceRequested = false;
	 hitTestSource = null;
         console.log('sess end')
       } );
*/
       hitTestSourceRequested = true;
     }

     if ( hitTestSource ) {
       let hitTestResults = frame.getHitTestResults( hitTestSource );
       if ( hitTestResults.length ) {
	 let hit = hitTestResults[ 0 ];
         reticle.visible = true;
         
         if(DEV_MODE && currentControl != 'court'){
           //Control reticle manually in dev mode here
         }else{
	   reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );
         }

         if( currentControl == 'court' || currentControl == 'resetCourt'){
           court.mesh.visible = true;
           court.mesh.matrix.copy( reticle.matrix );
           
           if(!planeDetected){
             dispatch('planeDetectionStateUpdate', {planeDetected: true});
             planeDetected = true;
           }
         }
       } else {
	 reticle.visible = false;
         if( currentControl == 'court' ){
           court.mesh.visible = false;
         }
       }
     }
   }

   let dt = clock.getDelta();
   if(courtSet){
     if(numberDevices == 2 && devicePlayerColor == currentPlayer){
       updatePhysics(dt);
       updateOtherDeviceWorld( {discs, cue:cue.cueGraphics});
     }else if(numberDevices == 1){
       updatePhysics(dt);
     }
     updateDiscGraphics();

     //Tests for changes in game states based on disc thrown or passing in play line
     if( currentControl == 'throw' ){
       if( discs[ currentTurnNumber ].status == 'oncue' ){
         testForThrownDisc();
       }else if( discs[ currentTurnNumber ].status == 'inplay' ){
         testForThrowOver();
       }
     }
   }

   renderer.render( scene, camera );
   
   if( stats ){
     stats.end();
   }
 }

 function updatePhysics(delta){
   world.step( fixedTimeStep, delta, maxSubSteps );

   if(showCue){
     cue.update(court.mesh.matrixWorld, oppositeSideInPlay);
   }
 }

 function updateDiscGraphics(){

   for( let disc of discs ){
     disc.mesh.position.set(
       disc.body.interpolatedPosition[0],
       discHeight,
       disc.body.interpolatedPosition[1]
     )
     disc.mesh.applyMatrix4( court.mesh.matrix );
   }
 }

 function onWindowResize() {
   camera.aspect = window.innerWidth / window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize( window.innerWidth, window.innerHeight );
 }

 function addAnchor(){
   anchor.quaternion.setFromRotationMatrix( reticle.matrixWorld );
   anchor.position.setFromMatrixPosition( reticle.matrix );

   anchor.translateY(anchorHeight / 2);
   anchor.visible = true;
 }

 export async function lockUIForATick(){
   lockUI = true;
   setTimeout( () => {
     lockUI = false;
   }, 40 );
 }

 function initStats(){
   stats = new Stats();
   overlayContainer.appendChild( stats.dom );
 }

 function initCourt(){
   court = new Court(courtWidth, courtHeight, courtLength, world);
   scene.add(court.mesh)
   court.addBounds();
   court.addScoringSensors();
 }

 function setCourt(){
   dispatch('courtSet', { });
   court.set();
   courtSet = true;
 }

 function initDiscs(){
   //All discs use same geometry and p2Material
   let discGeometry = new THREE.CylinderBufferGeometry( discRadius, discRadius, discHeight, 32, 1 );
   let p2Material = new Material();
   
   for(let i = 0; i < numDiscs; i++) {
     let color = i % 2 ? 'red' : 'blue'
     let disc = new Disc(discGeometry, color, discRadius, discMass, discDamping, p2Material);
     scene.add(disc.mesh);
     world.addBody( disc.body )
     discs.push( disc );
   }
 }


 function setDiscs(){
   let pos = new THREE.Vector3();
   court.mesh.getWorldPosition( pos );
   
   for( let idx = 0; idx < discs.length; idx++ ){
     let disc = discs[idx];
     let x = 0;
     let z = oppositeSideInPlay ? -1 * (idx - 2) * court.length / 16 : (idx - 2) * court.length / 16;
     disc.set(x, z, court.mesh.matrixWorld)
     disc.setCollisionMask();
    }

   if(discs.length > 1){
     world.addContactMaterial(new ContactMaterial(discs[0].shape.material, discs[1].shape.material, {
       restitution : discRestitution
     }));
   }

   giveDiscsRandomMotion();
   window.discs = discs
 }

 function giveDiscsRandomMotion(){
   discs.forEach( disc => {
     disc.randomMotion();
   });
 }

 function initCue(){
   cue = new Cue(cueWidth, cueHeight, cueDepth, discHeight, reticle, DEV_MODE)
   scene.add(cue.cueGraphics);
   world.addBody(cue.cueBody);
   showCue = true;
   cue.setCollisions(currentPlayer);
 }

 function setDiscsDamping( val ){
   discs.forEach( d => {
     val = Math.max(Math.min(val, 1), 0);
     d.body.damping = val;
   });
 }

 function startGame(){
   dispatch('startGame', {});
   resetDiscs(false);
   startPlayerTurn();
 }

 function resetDiscs(switchSides){
   if(switchSides){
     oppositeSideInPlay = !oppositeSideInPlay;
   }
   currentTurnNumber = 0;
   for( let disc of discs ){
     disc.reset(court.length, oppositeSideInPlay, false)
   }
 }

 function startPlayerTurn(){
   currentPlayer = discs[ currentTurnNumber ].discColor;
   overlayComponent.setCurrentPlayer( currentPlayer );
   if( currentPlayer == 'red'){
     cue.material.color.setHex( 0xff0000 );
   }else{
     cue.material.color.setHex( 0x0000ff );
   }
   cue.setCollisions(currentPlayer);

   if(currentTurnNumber > 0){
     discs[currentTurnNumber - 1].status = 'inplay';
     discs[currentTurnNumber - 1].setCollisionMask();
   }
   discs[ currentTurnNumber ].startTurn();
 }

 function throwCurrentDisc(){
   if(Math.abs(discs[ currentTurnNumber ].body.velocity[1]) > .05){
     discs[ currentTurnNumber ].body.force[1] += .1 * (oppositeSideInPlay ? 1 : -1)
     return
   }
   let xf = (Math.random() - 0.5) * 6 * gameScale;
   let yf = oppositeSideInPlay
          ? (Math.random() * 8.0+ 16.5) * gameScale * 2
          : -(Math.random() * 8.0+ 16.5) * gameScale * 2;
   discs[ currentTurnNumber ].mockThrow(xf, yf);
 }

 export function moveOnToNextTurn(){
   currentTurnNumber++;
   dispatch('changeControls', { controlType: 'throw' });
   startPlayerTurn();
 }

 export function handleSwitchPlayerDevices(){
   currentTurnNumber++;
   dispatch('changeControls', { controlType: 'throw' });
   startPlayerTurn();   
 }

 function handleRoundOver(){
   let { sensorOverlaps, roundScore } = court.getRoundScore()

   let roundWinner, scoreDiff;
   if(roundScore.red > roundScore.blue){
     roundWinner = 'red'
     console.log( 'Red: ', roundScore.red - roundScore.blue)
     scoreDiff = roundScore.red - roundScore.blue;
   }else if(roundScore.blue > roundScore.red){
     roundWinner = 'blue'
     console.log( 'Blue: ', - roundScore.red + roundScore.blue)
     scoreDiff = roundScore.blue - roundScore.red;
   }else{
     console.log( 'Tie: ', 0 );
     scoreDiff = 0;
   }

   if( testForGameOver(roundScore) ){
     dispatch('updateScore', {color: roundWinner, value: scoreDiff, gameOver: true})
     handleGameOver();
     return
   }
   
   dispatch('updateScore', {color: roundWinner, value: scoreDiff, gameOver: false})
   discs[ currentTurnNumber - 1 ].status = 'inactive'
   currentTurnNumber = 0;
   
   setTimeout( () => {
     moveOnToNextRound(roundWinner)
   }, 3000 );
 }

 function moveOnToNextRound(previousRoundWinner){
   //TODO - show prompt / arrow to switch sides
   //dispatch('changeControls', { controlType: 'throw' });
   dispatch('startRound', {});
   
   //set next player to the winner of previous round
   if( previousRoundWinner != discs[0].discColor ){
     discs.push( discs.shift() );
   }

   resetDiscs(true);
   startPlayerTurn();
 }


 function testForThrownDisc(){
   if( Math.abs(discs[currentTurnNumber].body.position[1]) < court.inPlayLine ){
     handleThrownDisc();
   }
 }

 function handleThrownDisc(){
   discs[currentTurnNumber].setToInPlay();
   dispatch('updateDiscInPlayStatus', {status: true});
 }

 function testForThrowOver(){
   let sleepStatus = discs.map(d => d.body.sleepState)
   if( sleepStatus.every( s => s === Body.SLEEPING ) ){
     handleThrowOver();
   }
 }

 function handleThrowOver(){
   console.log('THROW OVER')
   if(currentTurnNumber >= discs.length - 1){
     handleRoundOver()
   }else{
     if(DEV_MODE){
       //webxr extension doesn't support overlay, so you can't have a button to click
       moveOnToNextTurn();
     }else if(numberDevices == 1){
       promptPlayerTransition();
     }else{
       //TODO -- how to handle throw over when 2 players?
       //handleSwitchPlayerDevices();
     }
   }
   //overlayComponent.setDiscControlDisplayState(false);
   dispatch('updateDiscInPlayStatus', {status: false});
 }

 function promptPlayerTransition(){
   cue.disable();
   let nextPlayer = currentPlayer == 'red' ? 'blue' : 'red';
   dispatch( 'switchPlayers', {nextPlayer} );
 }

 function testForGameOver(roundScore){
   return (gameScore.red + roundScore.red) > scoreThreshold || (gameScore.blue + roundScore.blue) > scoreThreshold
 }

 function handleGameOver(){
   if( gameScore.red > scoreThreshold ){
     dispatch('gameOver', {winner: 'red'})
 
   }else if( gameScore.blue > scoreThreshold ){
     dispatch('gameOver', {winner: 'blue'})
   }
   for( let disc of discs ){
     disc.handleGameOver();
   }
   currentTurnNumber = 0;
   oppositeSideInPlay = false;
 }

 function initDevKeyListeners(){
   //Initializes key listeners used during dev mode, used for moving cue with arrow keys
   let d = .025
   document.addEventListener('keydown', event => {
     if(!cue) return
     reticle.getWorldPosition(cue.cursorPos)
     let f = 20;
     switch(event.which){
       case 38:
         //up
         if(event.shiftKey) applyForceToThrownDisc([0, -1])
         cue.cursorPos.z -= d
         break;
       case 40:
         //down
         if(event.shiftKey) applyForceToThrownDisc([0, 1])
         cue.cursorPos.z += d
         break;
       case 37:
         //left
         if(event.shiftKey) applyForceToThrownDisc([-1, 0])
         cue.cursorPos.x -= d;
         break;
       case 39:
         //right
         if(event.shiftKey) applyForceToThrownDisc([1, 0])
         cue.cursorPos.x += d;
         break;
     }
     reticle.matrix.setPosition(cue.cursorPos.x, cue.cursorPos.y, cue.cursorPos.z)
   });
 }

 function handleGameScaleChange(){
   let scaleFactor = 1.5 * gameScale / court.width
   courtWidth = 1.5 * gameScale;
   courtLength = 9.1 * gameScale;
   discRadius = .1 * gameScale;
   discMass = .425 * gameScale;//kg - not sure if it should be changed to grams
   cueWidth = discRadius * 6;
   cueHeight = discRadius / 4;
   cueDepth = discRadius / 2;
   devModeCueOffset = -courtLength * .425;
   court.mesh.geometry.scale( scaleFactor, 1, scaleFactor )
 }

 export function applyForceToThrownDisc([xFactor, yFactor]){
   discs[ currentTurnNumber ].nudge([xFactor, yFactor]);
 }

 function resetCourt(){
   dispatch('resetCourt', {});
   court.set();
   courtSet = true;
   for(let d of discs){
     if(d.status != 'inactive'){
       d.mesh.visible = true;
     }
   }
 }

 export function saveGame(){
   if(!courtSet){
     console.log('Can\'t save game if court is not set')
     return
   }
   let data = {
     gameScore,
     gameScale,
     discPositions: discs.map(d => d.body.position),
     currentPlayer,
     currentTurnNumber,
     oppositeSideInPlay
   };

   axios.post(serverSaveURL, {data})
        .then(response => {
          console.log('saved: ', response.data);
        }).catch(error => {
          console.log('Error saving game: ', error)
        });
 }

 export function loadGame(){
   if(!courtSet){
     console.log('Can\'t load game if court is not set')
     return
   }
   console.log(serverLoadURL)
   axios.get(serverLoadURL)
        .then(response => {
          handleLoadGameData(response.data);
          console.log('loaded')
        }).catch( error => {
          console.log('Error loading game: ', error)
        });
 }

 function handleLoadGameData(gameData){
   dispatch('changeControls', { controlType: 'throw' });
   currentPlayer = gameData.currentPlayer;
   currentTurnNumber = gameData.currentTurnNumber;
   oppositeSideInPlay = gameData.oppositeSideInPlay;
   let discPositions = gameData.discPositions;

   if( currentPlayer != discs[currentTurnNumber].discColor ){
     discs.push( discs.shift() );
   }

   for(let i = 0; i < discs.length; i++){
     let d = discs[ i ];
     d.setFromLoadData(discPositions[i], i, currentTurnNumber, oppositeSideInPlay, court.length);
   }
   dispatch('setScore', {red: gameData.gameScore.red, blue: gameData.gameScore.blue});
   startPlayerTurn();
   //TODO - set game scale
 }

 export function updateGameFromData(data){
   if(!courtSet) return
   let _discs = data.discs;
   let _cue = data.cue;
   for(let i = 0; i < _discs.length; i++){
     discs[i].setFromNetworkData(_discs[i]);
   }
 }

 export let updateOtherDeviceWorld;//function passed in from App.svelte
 export let updateOtherDeviceGame;//function passed in from App.svelte

 function handleSwitchPlayeDevices(){
   //TODO
 }

 window.saveGame = saveGame;
 window.loadGame = loadGame;
 
 
</script>

<style>
</style>



<div class="canvas-container">
  <canvas bind:this={canvas}></canvas>
</div>
