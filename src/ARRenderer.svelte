<script>
 export let overlayComponent;
 export let overlayContainer;
 export let currentControl;
 export let gameScore;
 export let gameScale;
 export let numDiscs;
 export let numberDevices;
 
 export let DEV_MODE;
 export let DEBUG_MODE;
  
 import * as THREE from 'three';
 import { Body, World, Circle, Plane, Box, Convex, DistanceConstraint, PrismaticConstraint, ContactMaterial, Material, vec2 } from "p2";
 import Stats from 'stats-js';
 import axios from 'axios';
 import { createEventDispatcher, tick } from 'svelte';

 import scoringAreas from './scoringAreas';
 const dispatch = createEventDispatcher();

 const serverURL = window.location.protocol == 'http'
                 ? window.location.origin.replace(window.location.port, 3000)
                 : 'https://' + window.location.hostname + ':3001';
 const serverSaveURL = serverURL + '/saveGame'
 const serverLoadURL = serverURL + '/game'

 //Variables for app created three / p2 objects
 let canvas, camera, scene, renderer,
     controller,
     reticle,
     cursor = new THREE.Vector3(),
     cursorMat = new THREE.Matrix4(),
     cursorPos = new THREE.Vector3(),
     cursorQuat = new THREE.Quaternion(),
     cursorScale = new THREE.Vector3(1, 1, 1),
     cursorEuler = new THREE.Euler(),
     raycaster,
     screenCenter = new THREE.Vector2(),
     mouse = new THREE.Vector2(),
     anchor,
     court,
     discs = [],
     cueShape1,
     cueShape2,
     cueBody,
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
  
 //Collison Masks
 let SCORINGAREAS = Math.pow(2, 0);
 let BOUNDS = Math.pow(2, 1);
 let REDCUE = Math.pow( 2, 2);
 let BLUECUE = Math.pow( 2, 3);
 let REDDISCS = Math.pow( 2, 4);
 let BLUEDISCS = Math.pow( 2, 5);


 //Game state / game scoring variables
 let currentPlayer = 'open';
 let currentTurnNumber;
 //Areas on the court worth specific point values
 let scoreAreas = [];
 //The line on the court that a disc must cross to be considered in play
 let inPlayLine; //
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
       d.visible = false;
     }
   }
 }

 init();
 
 function init(){
   initP2Physics();
   initScene();
   initCourt();
   animate();
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
   window.THREE = THREE;
 }

 function handleSelect(event) {
   if(lockUI) return

   switch ( currentControl ){
     case 'court':
       if ( reticle.visible) {
         addCourtSensors();
         initDiscs();
         setCourt();
         addBounds();
         setDiscs();
         initCue();
         setCueCollisions();
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
         resetCurrentDisc();
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

 function animate() {
   renderer.setAnimationLoop( render );
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
           
         }else{
	   reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );
         }

         if( currentControl == 'court' || currentControl == 'resetCourt'){
           court.visible = true;
           court.matrix.copy( reticle.matrix );
           
           if(!planeDetected){
             dispatch('planeDetectionStateUpdate', {planeDetected: true});
             planeDetected = true;
           }
         }
       } else {
	 reticle.visible = false;
         if( currentControl == 'court' ){
           court.visible = false;
         }
       }
     }

     /*
     if( DEBUG_MODE ){
       let pose = frame.getViewerPose(referenceSpace);
       if( pose ){
         let { x, y, z } = pose.views[0].transform.position;
         debugInfo.viewer = [ x.toFixed(2), y.toFixed(2), z.toFixed(2) ];
       }

       if( Math.random() > 0.8){
         reticle.matrixWorld.decompose( cursorPos, cursorQuat, cursorScale )
         debugInfo['reticle'] = cursorPos.toArray().map( p => p.toFixed(2) );
       }
       //overlayComponent.renderDebug( debugInfo );
     }
     */

   }

   let dt = clock.getDelta();
   if(courtSet){
     updatePhysics(dt);
   }

   renderer.render( scene, camera );
   
   if( stats ){
     stats.end();
   }
 }

 function updatePhysics(delta){
   world.step( fixedTimeStep, delta, maxSubSteps );
   for( let disc of discs ){
     disc.position.set(
       disc.userData.body.interpolatedPosition[0],
       discHeight,
       disc.userData.body.interpolatedPosition[1]
     )
     disc.applyMatrix4( court.matrix );
   }

   if(showCue){
     updateCue();
   }
 }

 function updateCue(){
   //Update cue position and angle based on the reticle position and angle
   
   //Get previous cue physics body position and angle and use it to update graphics
   cursorPos.set( cue.userData.body.interpolatedPosition[0], discHeight, cue.userData.body.interpolatedPosition[1] );
   cursorScale.set(1, 1, 1);
   cursorQuat.setFromAxisAngle( new THREE.Vector3( 0, -1, 0 ), cue.userData.body.angle );
   cue.matrix.compose(cursorPos, cursorQuat, cursorScale);
   cue.applyMatrix4( court.matrixWorld );

   //Get cursor matrix to use in calculating where cue physics body should be updated to
   cursorMat.getInverse( court.matrixWorld );
   cursorMat.multiply( reticle.matrixWorld );     
   cursorMat.decompose( cursorPos, cursorQuat, cursorScale );
   cursorEuler.setFromQuaternion( cursorQuat );

   //Set angle of cue
   let angle = cursorQuat.angleTo(new THREE.Quaternion()) * Math.sign(cursorEuler.y);
   if(angle < -Math.PI/2 && angle > -Math.PI){
     cue.userData.body.angle = 3 * Math.PI / 4 - angle
   }else if(Math.abs(angle) > Math.PI/2){
     cue.userData.body.angle = 3 * Math.PI / 4 - cursorQuat.angleTo(new THREE.Quaternion())
   }else{
     cue.userData.body.angle = 3 * Math.PI / 4 - cursorEuler.y;
   }

   //Update cue velocity based on difference between current reticle position and last cue position
   let deltaPos = [0,0];
   if(DEV_MODE){
     if(oppositeSideInPlay){
       vec2.sub(deltaPos, [cursorPos.x, cursorPos.z], cue.userData.body.position);
       vec2.set( cue.userData.body.velocity, deltaPos[0]*10, deltaPos[1]*10);
     }else{
       vec2.sub(deltaPos, [cursorPos.x, cursorPos.z], cue.userData.body.position);
       vec2.set( cue.userData.body.velocity, deltaPos[0]*10, deltaPos[1]*10);
     }
   }else{
     vec2.sub(deltaPos, [cursorPos.x, cursorPos.z], cue.userData.body.position);
     vec2.set( cue.userData.body.velocity, deltaPos[0]*5, deltaPos[1]*5);
   }

   //Test if currentDisc has been thrown
   if( currentControl == 'throw' && discs[ currentTurnNumber ].status == 'oncue'){
     testForThrownDisc();
   }else if( currentControl == 'throw' && discs[ currentTurnNumber ].status == 'inplay' ){
     testForThrowOver();
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

 function disposeObject(objThree, rigidBodiesIndex){
   physicsWorld.removeRigidBody(objThree.userData.body);
   scene.remove(objThree);
   if(rigidBodiesIndex !== undefined){
     rigidBodies.splice(rigidBodiesIndex, 1);
   }
 }

 function initStats(){
   stats = new Stats();
   overlayContainer.appendChild( stats.dom );
 }

 function initCourt(){
   let courtTexture = new THREE.TextureLoader().load( "court.png" );
   courtTexture.center = new THREE.Vector2( 0.5, 0.5 );
   courtTexture.rotation = - Math.PI / 2;
   let courtMaterial = new THREE.MeshBasicMaterial({transparent: true, opacity: 0.2, map: courtTexture});
   court = new THREE.Mesh(
     //new THREE.BoxBufferGeometry(courtLength, courtHeight, courtWidth).rotateY( - Math.PI / 2 ).translate( 0, 0, - courtLength / 2 ),
     new THREE.BoxBufferGeometry(courtWidth, courtHeight, courtLength),
     courtMaterial );

   court.matrixAutoUpdate = false;
   window.court = court
   court.visible = false;

   scene.add(court)
 }

 function setCourt(){
   dispatch('courtSet', { });
   court.material.opacity = 1.0;
   courtSet = true;
 }

 function initDiscs(){
   let discGeometry = new THREE.CylinderBufferGeometry( discRadius, discRadius, discHeight, 32, 1 );

   for(let i = 0; i < numDiscs; i++) {
     let material = new THREE.MeshBasicMaterial( );
     let disc = new THREE.Mesh( discGeometry, material );
     //disc.userData.discNumber = i;
     disc.visible = false;

     if(i % 2 == 0){
       disc.material.color.setHex(0xff0000);
       disc.userData.discColor = 'red';
     }else{
       disc.material.color.setHex(0x0000ff);
       disc.userData.discColor = 'blue'
     }

     scene.add(disc);     
     discs.push( disc );
   }
 }


 function setDiscs(){
   let pos = new THREE.Vector3();
   court.getWorldPosition( pos );

   let p2Material = new Material();
   
   for( let idx = 0; idx < discs.length; idx++ ){
     let disc = discs[idx];
     let x = 0;
     let z = oppositeSideInPlay ? -1 * (idx - 2) * courtLength / 16 : (idx - 2) * courtLength / 16;
     disc.position.set(x, .6, z)
     disc.applyMatrix4( court.matrixWorld );
     
     let circleShape = new Circle({radius: discRadius})
     circleShape.threeObj = disc;
     if(disc.userData.discColor == 'red'){
       circleShape.collisionGroup = REDDISCS;
     }else{
       circleShape.collisionGroup = BLUEDISCS;
     }
     let circleBody = new Body({mass: discMass, position: [x, z], allowSleep: false, fixedRotation: true});

     //circleShape1.material = new p2.Material();
     circleShape.material = p2Material;

     circleBody.addShape( circleShape );
     circleBody.damping = discDamping;
     circleBody.sleepSpeedLimit = .05;
     circleBody.sleepTimeLimit =  .4;
     //circleBody.sleepTimeLimit =  .5;
     
     world.addBody( circleBody );
     disc.userData.body = circleBody;
     disc.userData.shape = circleShape;
     disc.visible = true;
     //disc.status = 'inactive';
     disc.status = 'open';
     setDiscCollisionMask(disc);
    }

   if(discs.length > 1){
     world.addContactMaterial(new ContactMaterial(discs[0].userData.shape.material, discs[1].userData.shape.material, {
       restitution : discRestitution
     }));
   }

   giveDiscsRandomMotion();
   window.discs = discs
 }
 

 function addBounds(){
   let restitution = 1;
   let wallDepth = .05;
   let hwd = wallDepth / 2;
   let xCoord = courtWidth / 2 * 1.5;
   let yCoord = courtLength /2 * 1.5;
   let wallParams = [
     //Bottom wall
     [0, -yCoord, 0],
     //Left
     [-xCoord, 0, -Math.PI / 2],
     //top
     [0, yCoord, Math.PI],
     //right
     [xCoord, 0, Math.PI / 2],
   ];
   wallParams.forEach( (w, idx) => {
     let plane = new Body({
       position: w.slice(0, 2),
       angle: w[2],
     });
     let planeShape = new Plane();
     planeShape.collisionGroup = BOUNDS
     planeShape.collisionMask = REDDISCS | BLUEDISCS;
     plane.addShape( planeShape );
     plane.damping = 0;
     world.addBody( plane );
   });
 }

 function giveDiscsRandomMotion(){
   discs.forEach( disc => {
     let body = disc.userData.body;
     let v = {x: (Math.random() - 0.5) , y: (Math.random() - 0.5)  };
     //Matter.Body.setVelocity( body, v );
     disc.userData.body.force = [v.x*2, v.y* 2];
   });
 }

 function throwRandomDisc(){
   let disc = discs[Math.floor(Math.random() * discs.length)];
   let v = {x: (Math.random() - 0.5) , y: Math.random() > 0.5 ? 1 : -1};
   disc.userData.body.force = [v.x * 10, v.y * 40]
 }

 function initCue(){
   /*
   world.solver.iterations = 20;
   world.solver.tolerance = 0.01;
   world.islandSplit = true;
*/
   
   let cueMaterial = new THREE.MeshBasicMaterial( {color: 0xff00ff} );
   cue = new THREE.Group();

   let armWidth = cueWidth / 2;
   let cueArmOffset = armWidth/2 - cueDepth/2;
   
   let cue1 = new THREE.Mesh(
     new THREE.BoxBufferGeometry(armWidth, cueHeight, cueDepth).translate(-cueArmOffset, cueHeight/2, 0),
     cueMaterial
   );
   let cue2 = new THREE.Mesh(
     new THREE.BoxBufferGeometry(cueDepth, cueHeight, armWidth).translate(0, cueHeight/2, cueArmOffset),
     cueMaterial
   );
   cue.add( cue1 );
   cue.add( cue2 );
   cue.material = cueMaterial;
   scene.add(cue);
   let cueX = 0,
       cueY = 0;
   cue.matrixAutoUpdate = false;
   cue.matrix.setPosition(cueX, discHeight, cueY);
   cue.applyMatrix4( reticle.matrix );

   cueShape1 = new Box({width: armWidth, height: cueDepth});
   cueShape2 = new Box({height: armWidth, width: cueDepth});

   let cueBody = new Body({
     position: [cueX, cueY],
     allowSleep: false,
     fixedRotation: true,
     angle: 3 * Math.PI / 4,
     type: Body.KINEMATIC,
   });
   cueBody.addShape( cueShape1, [-cueArmOffset, 0])
   cueBody.addShape( cueShape2, [0, cueArmOffset] );
   world.addBody( cueBody );

   cueBody.angularDamping = .6;
   cueBody.damping = .3;

   cue.userData.body = cueBody

   window.cue = cue;
   showCue = true;
 }

 function setDiscsDamping( val ){
   discs.forEach( d => {
     val = Math.max(Math.min(val, 1), 0);
     d.userData.body.damping = val;
   });
 }

 function setCueCollisions(){
   if(currentPlayer == 'red'){
     cueShape1.collisionGroup = REDCUE;
     cueShape1.collisionMask = REDDISCS;
     cueShape2.collisionGroup = REDCUE;
     cueShape2.collisionMask = REDDISCS; 
   }else if(currentPlayer == 'blue'){
     cueShape1.collisionGroup = BLUECUE;
     cueShape1.collisionMask = BLUEDISCS;
     cueShape2.collisionGroup = BLUECUE;
     cueShape2.collisionMask = BLUEDISCS;
   }else{
     cueShape1.collisionGroup = BLUECUE | REDCUE;
     cueShape1.collisionMask = BLUEDISCS | REDDISCS;
     cueShape2.collisionGroup = BLUECUE | REDCUE;
     cueShape2.collisionMask = BLUEDISCS | REDDISCS;
   }
 }

 function setDiscCollisionMask(disc){
   if(disc.status == 'inactive'){
     disc.userData.shape.collisionMask = 0;
   }else if(disc.status == 'oncue'){
     disc.userData.shape.collisionMask = disc.userData.discColor == 'red'
                                       ? REDDISCS | BLUEDISCS | REDCUE | BOUNDS
                                       : REDDISCS | BLUEDISCS | BLUECUE | BOUNDS;
   }else if(disc.status == 'inplay'){
     disc.userData.shape.collisionMask = disc.userData.discColor == 'red'
                                       ? REDDISCS | BLUEDISCS | BOUNDS | SCORINGAREAS
                                       : REDDISCS | BLUEDISCS |  BOUNDS | SCORINGAREAS;
   }else if(disc.status == 'open'){
     disc.userData.shape.collisionMask = -1;
   }
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
     disc.status = 'inactive';
     disc.visible = false;
     disc.userData.body.position[0] = 0;
     if(oppositeSideInPlay){
       disc.userData.body.position[1] = courtLength / 2 * .8 * -1;
     }else{
       disc.userData.body.position[1] = courtLength / 2 * .8;
     }
     disc.userData.body.velocity[0] = 0;
     disc.userData.body.velocity[1] = 0;
     disc.userData.body.allowSleep = true;
     disc.userData.body.sleep();
     setDiscCollisionMask( disc );
   }
 }

 function resetCurrentDisc(){
   let disc = discs[ currentTurnNumber ];
   disc.userData.body.position[0] = 0;
   if(oppositeSideInPlay){
     disc.userData.body.position[1] = courtLength / 2 * .8 * -1;
   }else{
     disc.userData.body.position[1] = courtLength / 2 * .8;
   }
   disc.userData.body.velocity[0] = 0;
   disc.userData.body.velocity[1] = 0;
 }

 function startPlayerTurn(){
   currentPlayer = discs[ currentTurnNumber ].userData.discColor;
   overlayComponent.setCurrentPlayer( currentPlayer );
   if( currentPlayer == 'red'){
     cue.material.color.setHex( 0xff0000 );
   }else{
     cue.material.color.setHex( 0x0000ff );
   }
   setCueCollisions();

   if(currentTurnNumber > 0){
     discs[currentTurnNumber - 1].status = 'inplay';
     setDiscCollisionMask( discs[currentTurnNumber - 1] );
   }
   discs[currentTurnNumber].visible = 'true';
   discs[currentTurnNumber].status = 'oncue';
   discs[currentTurnNumber].userData.body.wakeUp();
   discs[currentTurnNumber].userData.body.allowSleep = false;
   setDiscCollisionMask( discs[currentTurnNumber] );
 }

 function throwCurrentDisc(){
   if(Math.abs(discs[ currentTurnNumber ].userData.body.velocity[1]) > .05){
     discs[ currentTurnNumber ].userData.body.force[1] += .1 * (oppositeSideInPlay ? 1 : -1)
     return
   }
   if(oppositeSideInPlay){
     discs[ currentTurnNumber ].userData.body.force = [
       (Math.random() - 0.5) * 6 * gameScale,
       (Math.random() * 8.0+ 16.5) * gameScale * 2
     ];
   }else{
     discs[ currentTurnNumber ].userData.body.force = [
       (Math.random() - 0.5) * 6 * gameScale,
       - (Math.random() * 8.0+ 16.5) * gameScale * 2
     ];
   }
 }

 export function moveOnToNextTurn(){
   currentTurnNumber++;
   dispatch('changeControls', { controlType: 'throw' });
   startPlayerTurn();
 }

 function handleRoundOver(){
   let { sensorOverlaps, roundScore } = getRoundScore()

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
   if( previousRoundWinner != discs[0].userData.discColor ){
     discs.push( discs.shift() );
   }

   resetDiscs(true);
   startPlayerTurn();
 }


 /*
    Scoring related functions
  */
 function addCourtSensors(){
   let { imageCourtWidth, imageCourtHeight, left, leftLineX} = scoringAreas;
   left.forEach( ({ value, vertices }) => {
     vertices = vertices.map( ([x,y]) => {
       //Flip the x and y, and scale to world court dimensions
       return [
         -1 * ( .5 - y / imageCourtHeight ) * courtWidth,
         ( .5 - x / imageCourtWidth ) * courtLength
       ];
     });


     let convexShape = new Convex({ vertices, sensor: true });
     convexShape.collisionGroup = SCORINGAREAS;
     convexShape.collisionMask = -1;
     let convexBody = new Body({ mass: 0, position: [0,0] });
     convexBody.scoreValue = value;
     convexBody.addShape( convexShape );
     world.addBody( convexBody );
     scoreAreas.push( convexBody )

     //Add mirrored sensors on opposite side of court
     vertices = vertices.map( ([x,y]) => {
       return [
         x,
         -1 * y
       ];
     });
     vertices.reverse();

     convexShape = new Convex({ vertices, sensor: true });
     convexShape.collisionGroup = SCORINGAREAS;
     convexShape.collisionMask = -1;
     convexBody = new Body({ mass: 0, position: [0,0] });
     convexBody.scoreValue = value;
     convexBody.addShape( convexShape );
     world.addBody( convexBody );
     scoreAreas.push( convexBody )

     inPlayLine = ( .5 - leftLineX / imageCourtWidth ) * courtLength;
   });

   /*
   world.on("beginContact",function(event){
     if(event.shapeA instanceof Convex || event.shapeB instanceof Convex)
       console.log(event.shapeA, event.shapeB)
   });
   */

   
   window.scoreAreas = scoreAreas;
   window.world = world
 }

 function getRoundScore(){
   let roundScore = {red: 0, blue: 0}
   let sensorOverlaps = [];
   let redScore = 0,
       blueScore = 0;
   
   for( let d of discs ){
     let hitTestResult = world.hitTest(d.userData.body.position, scoreAreas);

     if(hitTestResult && hitTestResult.length > 0){
       roundScore[d.userData.discColor] += hitTestResult[0].scoreValue
       sensorOverlaps.push({score: hitTestResult[0].scoreValue, color: d.userData.discColor})       
     }
   }
   roundScore.blue = Math.max(roundScore.blue, 0)
   roundScore.red = Math.max(roundScore.red, 0)
   return { sensorOverlaps, roundScore }
 }

 function testForThrownDisc(){
   if( Math.abs(discs[currentTurnNumber].userData.body.position[1]) < inPlayLine ){
     handleThrownDisc();
   }
 }

 function handleThrownDisc(){
   discs[currentTurnNumber].status = 'inplay'
   discs[currentTurnNumber].userData.body.allowSleep = true;
   setDiscCollisionMask( discs[ currentTurnNumber ] )
   dispatch('updateDiscInPlayStatus', {status: true});
 }

 function testForThrowOver(){
   let sleepStatus = discs.map(d => d.userData.body.sleepState)
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
     }
   }
   //overlayComponent.setDiscControlDisplayState(false);
   dispatch('updateDiscInPlayStatus', {status: false});
 }

 function promptPlayerTransition(){
   //TODO - lock screen from interactions and from cue colliding, show prompt to hand over device
   cueShape1.collisionMask = 0;
   cueShape2.collisionMask = 0;

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
     disc.status = 'open';
     setDiscCollisionMask( disc );
   }
   currentTurnNumber = 0;
   oppositeSideInPlay = false;
 }

 function initDevKeyListeners(){
   //Initializes key listeners used during dev mode, used for moving cue with arrow keys
   let d = .025
   document.addEventListener('keydown', event => {
     reticle.getWorldPosition(cursorPos)
     let f = 20;
     switch(event.which){
       case 38:
         //up
         if(event.shiftKey) applyForceToThrownDisc([0, -1])
         cursorPos.z -= d
         break;
       case 40:
         //down
         if(event.shiftKey) applyForceToThrownDisc([0, 1])
         cursorPos.z += d
         break;
       case 37:
         //left
         if(event.shiftKey) applyForceToThrownDisc([-1, 0])
         cursorPos.x -= d;
         break;
       case 39:
         //right
         if(event.shiftKey) applyForceToThrownDisc([1, 0])
         cursorPos.x += d;
         break;
     }
     reticle.matrix.setPosition(cursorPos.x, cursorPos.y, cursorPos.z)
   });
 }

 function handleGameScaleChange(){
   let scaleFactor = 1.5 * gameScale / courtWidth
   courtWidth = 1.5 * gameScale;
   courtLength = 9.1 * gameScale;
   discRadius = .1 * gameScale;
   discMass = .425 * gameScale;//kg - not sure if it should be changed to grams
   cueWidth = discRadius * 6;
   cueHeight = discRadius / 4;
   cueDepth = discRadius / 2;
   devModeCueOffset = -courtLength * .425;
   court.geometry.scale( scaleFactor, 1, scaleFactor )
 }

 export function applyForceToThrownDisc([xFactor, yFactor]){
   let f = (yFactor == 1 && xFactor == 0) ? .01 : .03

   if( oppositeSideInPlay ){
     discs[ currentTurnNumber ].userData.body.force[0] = xFactor * f * -1;
     discs[ currentTurnNumber ].userData.body.force[1] = yFactor * f;
   }else{
     discs[ currentTurnNumber ].userData.body.force[0] = xFactor * f;
     discs[ currentTurnNumber ].userData.body.force[1] = yFactor * f * -1;
   }

 }

 function resetCourt(){
   dispatch('resetCourt', {});
   court.material.opacity = 1.0;
   courtSet = true;
   for(let d of discs){
     if(d.status != 'inactive'){
       d.visible = true;
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
     discPositions: discs.map(d => d.userData.body.position),
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
   axios.get(serverLoadURL)
        .then(response => {
          syncGame(response.data);
          console.log('loaded')
        }).catch( error => {
          console.log('Error loading game: ', error)
        });
 }

 function syncGame(gameData){
   dispatch('changeControls', { controlType: 'throw' });
   currentPlayer = gameData.currentPlayer;
   currentTurnNumber = gameData.currentTurnNumber;
   oppositeSideInPlay = gameData.oppositeSideInPlay;
   let discPositions = gameData.discPositions;

   if( currentPlayer != discs[currentTurnNumber].userData.discColor ){
     discs.push( discs.shift() );
   }

   for(let i = 0; i < discs.length; i++){
     let d = discs[ i ];
     d.userData.body.velocity[0] = 0;
     d.userData.body.velocity[1] = 0;
     if(i < currentTurnNumber){
       d.userData.body.position = discPositions[i];
       d.userData.body.wakeUp();
       d.userData.body.allowSleep = true;
       d.visible = true;
       d.status = 'inplay';
     }else if(i == currentTurnNumber){
       d.status = 'oncue';
       d.visible = true;
       d.userData.body.position = discPositions[i];
     }else{
       d.visible = false;
       d.status = 'inactive';
       d.userData.body.position[0] = 0;
       if(oppositeSideInPlay){
         d.userData.body.position[1] = courtLength / 2 * .8 * -1;
       }else{
         d.userData.body.position[1] = courtLength / 2 * .8;
       }
       d.userData.body.velocity[0] = 0;
       d.userData.body.velocity[1] = 0;
       d.userData.body.allowSleep = true;
       d.userData.body.sleep();
     }
     setDiscCollisionMask( d );
   }
   dispatch('setScore', {red: gameData.gameScore.red, blue: gameData.gameScore.blue});
   startPlayerTurn();
   //TODO - set game scale
 }

 window.saveGame = saveGame;
 window.loadGame = loadGame;
 
 
</script>

<style>
</style>



<div class="canvas-container">
  <canvas bind:this={canvas}></canvas>
</div>
