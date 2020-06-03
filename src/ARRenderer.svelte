<svelte:head>
  <!--script async src="/lib/ammo.js" on:load={onAmmoLoaded}></script-->
</svelte:head>

<script>
 export let overlayComponent;
 export let overlayContainer;
 export let currentControl;
 export let showDebug;
 export let gameScore;
  
 import * as THREE from 'three';
 import { Body, World, Circle, Plane, Box, Convex, DistanceConstraint, PrismaticConstraint, ContactMaterial, Material, vec2 } from "p2";
 import Stats from 'stats-js';
 import { createEventDispatcher, tick } from 'svelte';

 import scoringAreas from './scoringAreas';
 window.scoringAreas = scoringAreas;
 const dispatch = createEventDispatcher();

 

 let DEV_MODE = window.location.search.includes( 'dev' );

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
     cueShape,
     cueBody,
     cue,
     showCue = false,
     reticleNullBody,
     reticleNullBody2,     
     helperMat = new THREE.Matrix4();
     //retPos = new THREE.Vec

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

 //p2/three parameter variables
 let anchorHeight = .2;
 let gameScale = 1 / 2;
 let courtWidth = 1.5 * gameScale;
 let courtLength = 9.1 * gameScale;
 let courtHeight = .02;
 let discRadius = .05;
 let discHeight = .01;
 let discMass = .425 * gameScale;//kg - not sure if it should be changed to grams
 let cueWidth = discRadius * 4;
 let cueHeight = discRadius;
 let cueDepth = discRadius;
 let cueConstraintLength = .25;
 let devModeCueOffset = -courtLength * .425;
 let discRestitution = 0.5;
 //let cueConstraintLength =  .25;
 
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
 let scoreThreshold = 6;

 //Variable to control which side of court is in play - 
 let oppositeSideInPlay = false;
 

 let lockUI = false;

  //Debug info/stats
 let stats;
 let debugInfo = {};

 init();
 
 function init(){
   initP2Physics();
   initScene();
   initCourt();
   addCourtSensors();
   initDiscs();
   animate();

   dispatch('appLoaded', {});
   
   if(showDebug){
     setTimeout  ( () => initStats, 500 );
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
   controller.addEventListener( 'selectstart', handleSelectStart );
   controller.addEventListener( 'selectend', handleSelectEnd );
   
   scene.add( controller );

   let reticleTexture = new THREE.TextureLoader().load( "reticle-arrow.png" );

   reticle = new THREE.Mesh(
     new THREE.PlaneBufferGeometry(.2, .2).rotateX( - Math.PI / 2),
     new THREE.MeshBasicMaterial({map: reticleTexture, transparent: true, depthTest: false})
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
         setCourt();
         addBounds();
         setDiscs();
         initCue();
         setCueCollisions();
       }
       break;
     case 'inactive':
       startGame();
       break;
     case 'throw':
       if(DEV_MODE){
         throwCurrentDisc();
       }
       break;
   }
 }
 window.handleSelect = handleSelect

 function handleSelectStart(event){
   
 }
 
 function handleSelectEnd(){
   
 }

 function handleClick(event){
   
 }



 function initP2Physics(){
   world = new World({
     gravity:[0, 0]
   });

   world.sleepMode = World.BODY_SLEEPING;
 }

 function animate() {
   renderer.setAnimationLoop( render );
 }

 function render( timestamp, frame ) {

   if( stats ){
     stats.begin();
   }

   if ( frame ) {

     var referenceSpace = renderer.xr.getReferenceSpace();
     var session = renderer.xr.getSession();

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

       var hitTestResults = frame.getHitTestResults( hitTestSource );

       if ( hitTestResults.length ) {

	 var hit = hitTestResults[ 0 ];

	 reticle.visible = true;
	 reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );

         if( currentControl == 'court'){
           //court.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );
           court.visible = true;
           court.matrix.copy( reticle.matrix );
         }


       } else {
         
	 reticle.visible = false;
         if( currentControl == 'court' ){
           court.visible = false;
         }

       }

     }
     
     if( showDebug ){
       let pose = frame.getViewerPose(referenceSpace);

       if( pose ){
         let { x, y, z } = pose.views[0].transform.position;
         debugInfo.viewer = [ x.toFixed(2), y.toFixed(2), z.toFixed(2) ];
       }

       if( Math.random() > 0.8){
         reticle.matrixWorld.decompose( cursorPos, cursorQuat, cursorScale )
         debugInfo['reticle'] = cursorPos.toArray().map( p => p.toFixed(2) );
       }

     }

   }


   let dt = clock.getDelta();
   if(courtSet){
     updatePhysics(dt);
   }

   renderer.render( scene, camera );

   if(showDebug){
     overlayComponent.renderDebug( debugInfo );
   }

   if( stats ){
     stats.end();
   }

 }

 function updatePhysics(delta){
   world.step( fixedTimeStep, delta, maxSubSteps );
   //discs.forEach( (disc,idx) => {
   for( let disc of discs ){
     let pos = disc.userData.body.interpolatedPosition;
     disc.position.set(
       pos[0],
       discHeight,
       pos[1]
     )
     disc.applyMatrix4( court.matrix );
   }

   if(showCue){
     let cueAngle = reticleNullBody.interpolatedAngle;
     let cuePos = cue.userData.body.interpolatedPosition;

     let quaternion = new THREE.Quaternion();

     cursorPos.set( cuePos[0], discHeight, cuePos[1] );
     cursorScale.set(1, 1, 1);
     cursorQuat.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), cueAngle );
     cue.matrix.compose(cursorPos, cursorQuat, cursorScale);
     cue.applyMatrix4( court.matrixWorld );
     
     //Set helperMat to the inverse of the court's transformation matrix
     helperMat.getInverse( court.matrixWorld );
     
     cursorMat.copy( reticle.matrixWorld );
     cursorMat.multiply( helperMat );
     cursorMat.decompose( cursorPos, cursorQuat, cursorScale );
     cursorEuler.setFromQuaternion( cursorQuat );


     reticleNullBody.angle = cursorEuler.y;
     reticleNullBody2.angle = cursorEuler.y;
     cue.userData.body.angle = cursorEuler.y;

     let offset = [Math.cos(cursorEuler.y), Math.sin(cursorEuler.y)];
     if(DEV_MODE){
       if(oppositeSideInPlay){
         vec2.set( reticleNullBody.position, cursorPos.x - cueWidth / 2 - offset[0], -1 * (cursorPos.z - offset[0] - devModeCueOffset));
         vec2.set( reticleNullBody2.position, cursorPos.x + cueWidth / 2 + offset[0], -1 * (cursorPos.z + offset[0] - devModeCueOffset));
       }else{
         vec2.set( reticleNullBody.position, cursorPos.x - cueWidth / 2 - offset[0], cursorPos.z - offset[0] - devModeCueOffset);
         vec2.set( reticleNullBody2.position, cursorPos.x + cueWidth / 2 + offset[0], cursorPos.z + offset[0] - devModeCueOffset);
       }
     }else{
       vec2.set( reticleNullBody.position, cursorPos.x - cueWidth / 2 - offset[0], cursorPos.z - offset[0]);
       vec2.set( reticleNullBody2.position, cursorPos.x + cueWidth / 2 + offset[0], cursorPos.z + offset[0]);
     }

     //Test if currentDisc has been thrown
     if( currentControl == 'throw' && discs[ currentTurnNumber ].status == 'oncue'){
       testForThrownDisc();
     }else if( currentControl == 'throw' && discs[ currentTurnNumber ].status == 'inplay' ){
       testForThrowOver();
     }

     /*
     if(Math.random() > .8){
       debugInfo['cueAngle'] = (cueAngle / Math.PI * 180).toFixed(0);
       debugInfo['angleY'] = (cursorEuler.y / Math.PI * 180).toFixed(0);
       debugInfo['rnb'] = reticleNullBody.position[0].toFixed(3);
       debugInfo['rnb2'] = reticleNullBody2.position[0].toFixed(3);
       debugInfo['cuebody'] = cue.userData.body.position[0].toFixed(3);
     }
     */

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
   dispatch('changeControls', { controlType: 'inactive' });
   court.material.opacity = 1.0;
   courtSet = true;
 }

 function initDiscs(){
   let discGeometry = new THREE.CylinderBufferGeometry( discRadius, discRadius, discHeight, 32, 1 );

   let numDiscs = 2;
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
     let circleBody = new Body({mass: discMass, position: [x, z]});

     //circleShape1.material = new p2.Material();
     circleShape.material = p2Material;

     circleBody.addShape( circleShape );
     circleBody.damping = 0.3;
     circleBody.sleepSpeedLimit = .1;
     circleBody.sleepTimeLimit =  1;
     //circleBody.sleepTimeLimit =  .5;
     
     world.addBody( circleBody );
     disc.userData.body = circleBody;
     disc.userData.shape = circleShape;
     disc.visible = true;
     //disc.status = 'inactive';
     disc.status = 'open';
     setDiscCollisionMask(disc);
    }

   world.addContactMaterial(new ContactMaterial(discs[0].userData.shape.material, discs[1].userData.shape.material, {
     restitution : discRestitution
   }));

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
   let mat = new THREE.MeshBasicMaterial( {color: 0xff00ff} );
   cue = new THREE.Mesh(
     new THREE.BoxBufferGeometry(cueWidth, cueHeight, cueDepth),
     mat
   );
   scene.add(cue);

   let cueX = 0,
       cueY = - cueDepth / 2 - cueConstraintLength / 2;
   if(DEV_MODE){
     //Move cue out of the way in dev mode
     cueY -= devModeCueOffset * 1.5;
   }
   cue.matrixAutoUpdate = false;
   cue.matrix.setPosition(cueX, discHeight, cueY);
   cue.applyMatrix4( reticle.matrix );

   cueShape = new Box({width: cueWidth, height: cueDepth});

   let cueBody = new Body({
     mass: 10, position: [cueX, cueY],
     //fixedRotation: true
   });
   cueBody.addShape( cueShape );
   world.addBody( cueBody );

   cueBody.angularDamping = .6;
   cueBody.damping = .3;

   cue.userData.body = cueBody

   //Init the constraint system for the cue
   reticleNullBody = new Body({
     //Reticle is at position 0,0 in relation to court
     position: [cueX - cueWidth / 2, 0],
     mass: 1000
   });
   world.addBody( reticleNullBody );

   reticleNullBody2 = new Body({
     //Reticle is at position 0,0 in relation to court
     position: [cueX + cueWidth / 2, 0],
     mass: 1000
   });
   world.addBody( reticleNullBody2 );   

   let cueConstraint = new PrismaticConstraint( reticleNullBody, cueBody , {
     localAnchorA: [0, 0],
     localAnchorB: [-cueWidth/2, -cueDepth / 2],
     upperLimit: 0,
     lowerLimit: 0,
     localAxisA: [0, -cueDepth/2]
   });
   world.addConstraint( cueConstraint );

   let cueConstraint2 = new PrismaticConstraint( reticleNullBody2, cueBody , {
     localAnchorA: [0, 0],
     localAnchorB: [cueWidth / 2, -cueDepth / 2],
     upperLimit: 0,
     lowerLimit: 0,
     localAxisA: [0, -cueDepth/2]
   });
   world.addConstraint( cueConstraint2 );

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
     cueShape.collisionGroup = REDCUE;
     cueShape.collisionMask = REDDISCS; 
   }else if(currentPlayer == 'blue'){
     cueShape.collisionGroup = BLUECUE;
     cueShape.collisionMask = BLUEDISCS;
   }else{
     cueShape.collisionGroup = BLUECUE | REDCUE;
     cueShape.collisionMask = BLUEDISCS | REDDISCS;
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
     disc.userData.body.sleep();
     setDiscCollisionMask( disc );
   }
 }

 function startPlayerTurn(){
   //TODO: prompt next user in overlay
   currentPlayer = discs[ currentTurnNumber ].userData.discColor;
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
   setDiscCollisionMask( discs[currentTurnNumber] );
 }

 function throwCurrentDisc(){
   if(oppositeSideInPlay){
     discs[ currentTurnNumber ].userData.body.force = [ (Math.random() - 0.5) * 2, (Math.random() * 3.0+ 14.0)];
   }else{
     discs[ currentTurnNumber ].userData.body.force = [ (Math.random() - 0.5) * 2, - (Math.random() * 3.0+ 14.0)];
   }
 }

 function moveOnToNextTurn(){
   currentTurnNumber++;
   //currentControl = 'throw'
   dispatch('changeControls', { controlType: 'throw' });
   startPlayerTurn();
 }

 function handleRoundOver(){
   let { sensorOverlaps, roundScores } = getRoundScores()

   let roundWinner;
   if(roundScores.red > roundScores.blue){
     roundWinner = 'red'
     console.log( 'Red: ', roundScores.red - roundScores.blue)
     dispatch('updateScore', {color: 'red', value: roundScores.red - roundScores.blue})
     //gameScore.red += roundScores.red - roundScores.blue
   }else if(roundScores.blue > roundScores.red){
     roundWinner = 'blue'
     console.log( 'Blue: ', - roundScores.red + roundScores.blue)
     //gameScore.blue += roundScores.blue - roundScores.red
     dispatch('updateScore', {color: 'blue', value: roundScores.blue - roundScores.red})
   }else{
     console.log( 'Tie: ', 0 );
   }
   if( gameIsOver() ){
     handleGameOver();
     return
   }

   discs[ currentTurnNumber - 1 ].status = 'inactive'
   currentTurnNumber = 0;
   
   //TODO - set cue body position to otherside of court if in dev mode?
   
   setTimeout( () => {
     moveOnToNextRound(roundWinner)
   }, 3000 );
 }

 function moveOnToNextRound(previousRoundWinner){
   //TODO - show prompt / arrow to switch sides
   //currentControl = 'throw';
   dispatch('changeControls', { controlType: 'throw' });
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

 function getRoundScores(){
   let roundScores = {red: 0, blue: 0}
   let sensorOverlaps = [];
   let redScore = 0,
       blueScore = 0;
   
   Object.values(world.overlapKeeper.overlappingShapesCurrentState.data).forEach( o => {
     if(o.shapeA instanceof Convex){
       if(o.bodyA.aabb.containsPoint(o.bodyB.position)){
         roundScores[o.shapeB.threeObj.userData.discColor] += o.bodyA.scoreValue
         sensorOverlaps.push({overlap: o, score: o.bodyA.scoreValue, color: o.shapeB.threeObj.userData.discColor})
       }
     }else if(o.shapeB instanceof Convex){
       if(o.bodyB.aabb.containsPoint(o.bodyA.position)){
         roundScores[o.shapeA.threeObj.userData.discColor] += o.bodyB.scoreValue
         sensorOverlaps.push({overlap: o, score: o.bodyB.scoreValue, color: o.shapeA.threeObj.userData.discColor})
       }
     }
   });
   roundScores.blue = Math.max(roundScores.blue, 0)
   roundScores.red = Math.max(roundScores.red, 0)
   return { sensorOverlaps, roundScores }
 }

 function testForThrownDisc(){
   if( Math.abs(discs[currentTurnNumber].userData.body.position[1]) < inPlayLine ){
     handleThrownDisc();
   }
 }

 function handleThrownDisc(){
   console.log( 'THROWN');
   discs[currentTurnNumber].status = 'inplay'
   setDiscCollisionMask( discs[ currentTurnNumber ] )
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
     discs.forEach( disc => disc.userData.body.wakeUp() );
     setTimeout( () => {
       handleRoundOver()
     }, 1 );
   }else{
     moveOnToNextTurn();
   }
 }

 function gameIsOver(){
   return gameScore.red > scoreThreshold || gameScore.blue > scoreThreshold
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

 
 window.getRoundScores = getRoundScores
 window.handleRoundOver = handleRoundOver;
 window.sdd = setDiscsDamping
 window.hto = handleThrowOver

</script>

<style>
</style>



<div class="canvas-container">
  <canvas bind:this={canvas}></canvas>
</div>
