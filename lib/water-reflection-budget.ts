/** Keep the full reflection on fast devices; skip reflection-only passes when
 * camera frames are consistently late. The water surface itself still renders
 * every frame, so ripples and camera movement remain responsive. */
export class WaterReflectionBudget {
  private lastCameraFrame=-Infinity;
  private lastReflection=-Infinity;
  private lateFrames=0;
  private averageGap=16.7;
  private constrainedUntil=0;

  shouldUpdate(now:number,cameraChanged:boolean,sceneChanged:boolean,force=false){
    if(!cameraChanged&&!sceneChanged){this.lastCameraFrame=-Infinity;return false;}
    // A resized lens cannot reuse the old projective texture coordinates.
    if(force){this.lastCameraFrame=now;this.lastReflection=now;this.lateFrames=0;return true;}
    if(cameraChanged){
      const gap=now-this.lastCameraFrame;
      if(gap>0&&gap<500){
        this.averageGap=this.averageGap*.8+gap*.2;
        this.lateFrames=gap>24?Math.min(12,this.lateFrames+1):Math.max(0,this.lateFrames-2);
      }else{this.lateFrames=0;this.averageGap=16.7;}
      this.lastCameraFrame=now;
      if(this.lateFrames>=6)this.constrainedUntil=now+1800;
    }else this.lastCameraFrame=-Infinity;
    if(now<this.constrainedUntil&&now-this.lastReflection<Math.max(45,this.averageGap*1.5))return false;
    this.lastReflection=now;
    return true;
  }
}
