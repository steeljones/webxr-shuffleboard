import * as THREE from 'three';
import { Body, Box, vec2 } from "p2";
import { SCORINGAREAS, BOUNDS, REDCUE, BLUECUE, REDDISCS, BLUEDISCS } from './collisionConstants';

export default class {
  constructor(width, height, depth, transformMatrix, discHeight, reticle, DEV_MODE){
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.discHeight = discHeight;
    this.reticle = reticle;
    this.DEV_MODE = DEV_MODE;

    //Helper three js objects
    this.cursorPos = new THREE.Vector3();
    this.cursorScale = new THREE.Vector3(1,1,1);
    this.cursorQuat = new THREE.Quaternion();
    this.cursorMat = new THREE.Matrix4();
    this.cursorEuler = new THREE.Euler();
    this.zeroQuat = new THREE.Quaternion();

    let cueMaterial = new THREE.MeshBasicMaterial( {color: 0xff00ff} );
    this.cueGraphics = new THREE.Group();

    let armWidth = this.width / 2;
    let cueArmOffset = armWidth/2 - this.depth/2;
    
    let cue1 = new THREE.Mesh(
      new THREE.BoxBufferGeometry(armWidth, this.height, this.depth).translate(-cueArmOffset, this.height/2, 0),
      cueMaterial
    );
    let cue2 = new THREE.Mesh(
      new THREE.BoxBufferGeometry(this.depth, this.height, armWidth).translate(0, this.height/2, cueArmOffset),
      cueMaterial
    );
    this.cueGraphics.add( cue1 );
    this.cueGraphics.add( cue2 );
    this.material = cueMaterial;
    let cueX = 0,
        cueY = 0;
    this.cueGraphics.matrixAutoUpdate = false;
    this.cueGraphics.matrix.setPosition(cueX, this.discHeight, cueY);
    this.cueGraphics.applyMatrix4( transformMatrix );

    this.cueShape1 = new Box({width: armWidth, height: this.depth});
    this.cueShape2 = new Box({height: armWidth, width: this.depth});

    this.cueBody = new Body({
      position: [cueX, cueY],
      allowSleep: false,
      fixedRotation: true,
      angle: 3 * Math.PI / 4,
      type: Body.KINEMATIC,
    });
    this.cueBody.addShape( this.cueShape1, [-cueArmOffset, 0])
    this.cueBody.addShape( this.cueShape2, [0, cueArmOffset] );

    this.cueBody.angularDamping = .6;
    this.cueBody.damping = .3;
  }
  update(courtMatrixWorld, oppositeSideInPlay){
   //Update cue position and angle based on the reticle position and angle
   //Get previous cue physics body position and angle and use it to update graphics
   this.cursorPos.set( this.cueBody.interpolatedPosition[0], this.discHeight, this.cueBody.interpolatedPosition[1] );
   this.cursorQuat.setFromAxisAngle( new THREE.Vector3( 0, -1, 0 ), this.cueBody.angle );
   this.cueGraphics.matrix.compose(this.cursorPos, this.cursorQuat, this.cursorScale);
   this.cueGraphics.applyMatrix4( courtMatrixWorld );

   //Get cursor matrix to use in calculating where cue physics body should be updated to
   this.cursorMat.getInverse( courtMatrixWorld );
   this.cursorMat.multiply( this.reticle.matrixWorld );     
   this.cursorMat.decompose( this.cursorPos, this.cursorQuat, this.cursorScale );
   this.cursorEuler.setFromQuaternion( this.cursorQuat );

   //Set angle of cue
   let angle = this.cursorQuat.angleTo(new THREE.Quaternion()) * Math.sign(this.cursorEuler.y);
   if(angle < -Math.PI/2 && angle > -Math.PI){
     this.cueBody.angle = 3 * Math.PI / 4 - angle
   }else if(Math.abs(angle) > Math.PI/2){
     this.cueBody.angle = 3 * Math.PI / 4 - this.cursorQuat.angleTo(this.zeroQuat);
   }else{
     this.cueBody.angle = 3 * Math.PI / 4 - this.cursorEuler.y;
   }

   //Update cue velocity based on difference between current reticle position and last cue position
   let deltaPos = [0,0];
   if(this.DEV_MODE){
     if(oppositeSideInPlay){
       vec2.sub(deltaPos, [this.cursorPos.x, this.cursorPos.z], this.cueBody.position);
       vec2.set( this.cueBody.velocity, deltaPos[0]*10, deltaPos[1]*10);
     }else{
       vec2.sub(deltaPos, [this.cursorPos.x, this.cursorPos.z], this.cueBody.position);
       vec2.set( this.cueBody.velocity, deltaPos[0]*10, deltaPos[1]*10);
     }
   }else{
     vec2.sub(deltaPos, [this.cursorPos.x, this.cursorPos.z], this.cueBody.position);
     vec2.set( this.cueBody.velocity, deltaPos[0]*5, deltaPos[1]*5);
   }
  }
  setCollisions(currentPlayer){
    if(currentPlayer == 'red'){
      this.cueShape1.collisionGroup = REDCUE;
      this.cueShape1.collisionMask = REDDISCS;
      this.cueShape2.collisionGroup = REDCUE;
      this.cueShape2.collisionMask = REDDISCS; 
    }else if(currentPlayer == 'blue'){
      this.cueShape1.collisionGroup = BLUECUE;
      this.cueShape1.collisionMask = BLUEDISCS;
      this.cueShape2.collisionGroup = BLUECUE;
      this.cueShape2.collisionMask = BLUEDISCS;
    }else{
      this.cueShape1.collisionGroup = BLUECUE | REDCUE;
      this.cueShape1.collisionMask = BLUEDISCS | REDDISCS;
      this.cueShape2.collisionGroup = BLUECUE | REDCUE;
      this.cueShape2.collisionMask = BLUEDISCS | REDDISCS;
    }
  }
  disable(){
    this.cueShape1.collisionMask = 0;
    this.cueShape2.collisionMask = 0;
  }
}
