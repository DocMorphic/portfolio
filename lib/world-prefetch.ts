import {WORLD_PREFETCH_IMAGES} from "./world-assets.mjs";

let pending:Promise<void>|null=null;

/** Start the largest world downloads when the visitor chooses the tram. The
 * dinosaur loader can then build the scene from the browser cache. */
export function prefetchWorldAssets(){
  if(typeof navigator==="undefined")return Promise.resolve();
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if(connection?.saveData)return Promise.resolve();
  pending??=(async()=>{
    for(const url of WORLD_PREFETCH_IMAGES){
      try{
        const response=await fetch(url,{cache:"force-cache",priority:"low"});
        if(response.ok)await response.blob();
      }catch{/* Loading the actual world will retry and retain its fallback. */}
    }
  })();
  return pending;
}
