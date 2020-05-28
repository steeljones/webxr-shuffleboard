<svelte:head>
  <!--script async src="/lib/ammo.js" on:load={onAmmoLoaded}></script-->
</svelte:head>

<script>
 export let overlayComponent;
 export let overlayContainer;
 export let currentControl;
 export let showDebug;
  
 import * as THREE from 'three';
  //import { p2 } from '/p2/src/p2.js'
 import { Body, World, Circle, Plane, Box, DistanceConstraint, PrismaticConstraint, vec2 } from "p2";

 
 import Stats from 'stats-js';
 import { createEventDispatcher, tick } from 'svelte';

 const dispatch = createEventDispatcher();

 let canvas;
 let camera, scene, renderer;
 let controller;


 //Variables for app created three / p2 objects
 let reticle,
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
     fixedTimeStep,
     maxSubSteps;

 //p2/three parameter variables
 let throwFactor = 6 * 1;
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
 
 

 let lockUI = false;

  //Debug info/stats
 let stats;
 let debugInfo = {};

 init();
 
 function init(){
   initP2Physics();
   initScene();
   initCourt();
   initDiscs();
   animate();


   //TODO - change this - no longer loading ammo
   dispatch('ammoLoaded', {});
   
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
       }
       break;
     case 'throw':
       throwDisc();
       break;
   }
 }
 window.handleSelect = handleSelect

 function handleSelectStart(event){
   console.log( 'start', event)
 }
 
 function handleSelectEnd(){
   console.log( 'end')
 }

 function handleClick(event){
   console.log('click')
 }



 function initP2Physics(){
   world = new World({
     gravity:[0, 0]
   });

   fixedTimeStep = 1/ 60;
   maxSubSteps = 10;
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
   discs.forEach( (disc,idx) => {
     let pos = disc.userData.body.interpolatedPosition;
     disc.position.set(
       pos[0],
       discHeight,
       pos[1]
     )
     disc.applyMatrix4( court.matrix );
   });

   if(showCue){
     //let cueAngle = cue.userData.body.interpolatedAngle;
     let cueAngle = reticleNullBody.interpolatedAngle;
     let cuePos = cue.userData.body.interpolatedPosition;

     let quaternion = new THREE.Quaternion();
     //quaternion.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), cueAngle );
     //cue.matrix.setPosition( cuePos[0], discHeight, cuePos[1] );

     cursorPos.set( cuePos[0], discHeight, cuePos[1] );
     cursorScale.set(1, 1, 1);
     //cursorQuat.set( 0, 0, 0, 1 );
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
     vec2.set( reticleNullBody.position, cursorPos.x - cueWidth / 2 - offset[0], cursorPos.z - offset[0])
     vec2.set( reticleNullBody2.position, cursorPos.x + cueWidth / 2 + offset[0], cursorPos.z + offset[0])
     
     if(Math.random() > .8){
       debugInfo['cueAngle'] = (cueAngle / Math.PI * 180).toFixed(0);
       debugInfo['angleY'] = (cursorEuler.y / Math.PI * 180).toFixed(0);
       debugInfo['rnb'] = reticleNullBody.position[0].toFixed(3);
       debugInfo['rnb2'] = reticleNullBody2.position[0].toFixed(3);
       debugInfo['cuebody'] = cue.userData.body.position[0].toFixed(3);
     }

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
   dispatch('changeControls', { controlType: 'throw' });
   court.material.opacity = 1.0;
   courtSet = true;
 }

 function initDiscs(){
   let discGeometry = new THREE.CylinderBufferGeometry( discRadius, discRadius, discHeight, 32, 1 );

   for(let i = 0; i < 30; i++) {
     let color = i < 4 ? 0xff0000 : 0x0000ff;
     let material = new THREE.MeshBasicMaterial( {color} );
     let disc = new THREE.Mesh( discGeometry, material );
     disc.userData.discNumber = i;
     disc.visible = false;
     scene.add(disc);     
     discs.push( disc );
   }
 }


 function setDiscs(){
   let pos = new THREE.Vector3();
   court.getWorldPosition( pos );
   discs.forEach( (disc, idx) => {
     let x = 0;
     let z = (idx - 2) * courtLength / 16;
     disc.position.set(x, .6, z)
     disc.applyMatrix4( court.matrixWorld );

     let circleBody = new Body({mass: discMass, position: [x, z]});
     let circleShape = new Circle({radius: discRadius})
     circleBody.addShape( circleShape );
     circleBody.damping = 0;
     world.addBody( circleBody );
     disc.userData.body = circleBody;
     disc.visible = true;
   });

   giveDiscsRandomMotion();
 }
 

 function addBounds(){
   let restitution = 1;;
   let wallDepth = .05;
   let hwd = wallDepth / 2;
   let xCoord = courtWidth / 2;
   let yCoord = courtLength /2;
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
     plane.addShape( new Plane() );
     plane.damping = 0;
     world.addBody( plane );
   });
 }

 function giveDiscsRandomMotion(){
   discs.forEach( disc => {
     let body = disc.userData.body;
     let v = {x: (Math.random() - 0.5) , y: (Math.random() - 0.5)  };
     //Matter.Body.setVelocity( body, v );
     disc.userData.body.force = [v.x*20, v.y* 20];
   });
 }

 function throwDisc(){
   let disc = discs[0];
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

   let cueConstraintLength = .25;
   let cueX = 0,
       cueY = - cueDepth / 2 - cueConstraintLength / 2;
   cue.matrixAutoUpdate = false;
   cue.matrix.setPosition(cueX, discHeight, cueY);
   cue.applyMatrix4( reticle.matrix );

   let cueShape = new Box({width: cueWidth, height: cueDepth});
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

 window.sdd = setDiscsDamping

</script>

<style>
</style>



<div class="canvas-container">
  <canvas bind:this={canvas}></canvas>
</div>
