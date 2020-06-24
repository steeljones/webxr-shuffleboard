import * as THREE from 'three';
import { Body, World, Circle, Box, ContactMaterial, Material, vec2 } from "p2";
import { SCORINGAREAS, BOUNDS, REDCUE, BLUECUE, REDDISCS, BLUEDISCS } from './collisionConstants';

export default class {
  constructor(geometry, height, color, radius, mass, damping, p2Material){
    this.radius = radius;
    this.height = height;
    this.material = new THREE.MeshBasicMaterial( );
    this.mesh = new THREE.Mesh( geometry, this.material );
    this.mesh.visible = false;

    if(color == 'red'){
      this.mesh.material.color.setHex(0xff0000);
      this.discColor = 'red';
    }else if(color == 'blue'){
      this.material.color.setHex(0x0000ff);
      this.discColor = 'blue'
    }

    this.shape = new Circle({radius: this.radius})
    if(this.discColor == 'red'){
      this.shape.collisionGroup = REDDISCS;
    }else{
      this.shape.collisionGroup = BLUEDISCS;
    }
    this.body = new Body({mass, allowSleep: false, fixedRotation: true});

    this.shape.material = p2Material;

    this.body.addShape( this.shape );
    this.body.damping = damping;
    this.body.sleepSpeedLimit = .05;
    this.body.sleepTimeLimit =  .4;
  }

  set(courtX, courtY, courtMatrixWorld){
    this.mesh.position.set(courtX, .6, courtY)
    this.mesh.applyMatrix4( courtMatrixWorld );
    this.body.position[0] = courtX;
    this.body.position[1] = courtY;
    this.mesh.visible = true;
    this.status = 'open'
  }

  randomMotion(){
    let v = {x: (Math.random() - 0.5) , y: (Math.random() - 0.5)  };
    this.body.force = [v.x*2, v.y* 2];
  }

  setCollisionMask(){
    if(this.status == 'inactive'){
      this.shape.collisionMask = 0;
    }else if(this.status == 'oncue'){
      this.shape.collisionMask = this.discColor == 'red'
        ? REDDISCS | BLUEDISCS | REDCUE | BOUNDS
        : REDDISCS | BLUEDISCS | BLUECUE | BOUNDS;
    }else if(this.status == 'inplay'){
      this.shape.collisionMask = this.discColor == 'red'
        ? REDDISCS | BLUEDISCS | BOUNDS | SCORINGAREAS
        : REDDISCS | BLUEDISCS |  BOUNDS | SCORINGAREAS;
    }else if(this.status == 'open'){
      this.shape.collisionMask = -1;
    }    
  }

  reset(courtLength, oppositeSideInPlay, isTapToReset=false){
    this.body.position[0] = 0;
    if(oppositeSideInPlay){
      this.body.position[1] = courtLength / 2 * .8 * -1;
    }else{
      this.body.position[1] = courtLength / 2 * .8;
    }
    this.body.velocity[0] = 0;
    this.body.velocity[1] = 0;
    
    if(!isTapToReset){
      this.status = 'inactive';
      this.mesh.visible = false;
      this.body.allowSleep = true;
      this.body.sleep();
      this.setCollisionMask();
    }
  }

  startTurn(){
    this.mesh.visible = true;
    this.status = 'oncue';
    this.body.wakeUp();
    this.body.allowSleep = false;
    this.setCollisionMask();    
  }

  mockThrow(xForce, yForce){
    this.body.force[0] = xForce;
    this.body.force[1] = yForce;
  }

  setToInPlay(){
    this.status = 'inplay';
    this.body.allowSleep = true;
    this.setCollisionMask();
  }

  handleGameOver(){
    this.status = 'open';
    this.setCollisionMask();
  }

  nudge([xFactor, yFactor], oppositeSideInPlay){
    let f = (yFactor == 1 && xFactor == 0) ? .01 : .03

    if( oppositeSideInPlay ){
      this.body.force[0] = xFactor * f * -1;
      this.body.force[1] = yFactor * f;
    }else{
      this.body.force[0] = xFactor * f;
      this.body.force[1] = yFactor * f * -1;
    }    
  }

  setFromLoadData(position, idx, currentTurnNumber, oppositeSideInPlay, courtLength){
    this.body.velocity[0] = 0;
    this.body.velocity[1] = 0;
    if(idx < currentTurnNumber){
      this.body.position = discPositions[i];
      this.body.wakeUp();
      this.body.allowSleep = true;
      this.mesh.visible = true;
      this.status = 'inplay';
    }else if(idx == currentTurnNumber){
      this.status = 'oncue';
      this.mesh.visible = true;
      this.body.position = position
    }else{
      this.reset(courtLength, oppositeSideInPlay, false);
    }
    this.setCollisionMask();    
  }

  setFromNetworkData(data){
    //this.body.interpolatedPosition[0] = data.position[0];
    //this.body.interpolatedPosition[1] = data.position[1];
    this.body.position[0] = data.position[0];
    this.body.position[1] = data.position[1];
    this.body.velocity[0] = data.velocity[0];
    this.body.velocity[1] = data.velocity[1];
    this.mesh.visible = data.visible;
  }

  updateGraphics(courtMatrix){
    this.mesh.position.set(
      this.body.interpolatedPosition[0],
      this.height,
      this.body.interpolatedPosition[1]
    )
    this.mesh.applyMatrix4( courtMatrix );
  }
}
