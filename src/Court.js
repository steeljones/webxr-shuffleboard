import * as THREE from 'three';
import { Body, Box, Convex, Plane, vec2 } from "p2";
import { BOUNDS, REDDISCS, BLUEDISCS, SCORINGAREAS } from './collisionConstants';
import scoringAreas from './scoringAreas';

export default class {
  constructor(width, height, length, p2World){
    this.width = width;
    this.height = height;
    this.length = length;
    this.world = p2World;
    let courtTexture = new THREE.TextureLoader().load( "court.png" );
    courtTexture.center = new THREE.Vector2( 0.5, 0.5 );
    courtTexture.rotation = - Math.PI / 2;
    let courtMaterial = new THREE.MeshBasicMaterial({transparent: true, opacity: 0.2, map: courtTexture});
    this.mesh = new THREE.Mesh(
      new THREE.BoxBufferGeometry(this.width, this.height, this.length),
      courtMaterial );

    this.mesh.matrixAutoUpdate = false;
    //window.court = this.mesh;
    this.mesh.visible = false;    
  }

  addBounds(){
    let restitution = 1;
    let wallDepth = .05;
    let hwd = wallDepth / 2;
    let xCoord = this.width / 2 * 1.5;
    let yCoord = this.length /2 * 1.5;
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
    this.bounds = [];
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
      //this.bounds.push(plane)
      this.world.addBody(plane)
    });
  }

  addScoringSensors(){
    let { imageCourtWidth, imageCourtHeight, left, leftLineX} = scoringAreas;
    
    this.scoreAreas = [];
    left.forEach( ({ value, vertices }) => {
      vertices = vertices.map( ([x,y]) => {
        //Flip the x and y, and scale to world court dimensions
        return [
          -1 * ( .5 - y / imageCourtHeight ) * this.width,
          ( .5 - x / imageCourtWidth ) * this.length
        ];
      });


      let convexShape = new Convex({ vertices, sensor: true });
      convexShape.collisionGroup = SCORINGAREAS;
      convexShape.collisionMask = -1;
      let convexBody = new Body({ mass: 0, position: [0,0] });
      convexBody.scoreValue = value;
      convexBody.addShape( convexShape );
      this.world.addBody( convexBody );
      this.scoreAreas.push( convexBody )

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
      this.world.addBody( convexBody );
      this.scoreAreas.push( convexBody )


    });
    this.inPlayLine = ( .5 - leftLineX / imageCourtWidth ) * this.length;
  }

  getRoundScore(){
    let roundScore = {red: 0, blue: 0}
    let sensorOverlaps = [];
    let redScore = 0,
        blueScore = 0;
    
    for( let d of discs ){
      let hitTestResult = this.world.hitTest(d.userData.body.position, this.scoreAreas);

      if(hitTestResult && hitTestResult.length > 0){
        roundScore[d.userData.discColor] += hitTestResult[0].scoreValue
        sensorOverlaps.push({score: hitTestResult[0].scoreValue, color: d.userData.discColor})       
      }
    }
    roundScore.blue = Math.max(roundScore.blue, 0)
    roundScore.red = Math.max(roundScore.red, 0)
    return { sensorOverlaps, roundScore }
  }

  set(){
    //Handle setting the court in place
    this.mesh.material.opacity = 1.0;
  }
}
