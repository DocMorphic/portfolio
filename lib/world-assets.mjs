/** Pixel-identical lossless WebP versions of the large world textures. */
export const WORLD_ASSETS={
  panorama:"/assets/alpine-panorama.webp",
  valley:"/assets/wooded-valley.webp",
  escarpment:"/assets/alpine-escarpment.webp",
  shoreForest:"/assets/shore-forest-detail.webp",
  billboard:"/assets/tram-roadside-billboard.webp",
  boardMaterials:"/assets/case-board-materials.webp",
};

/** Only prefetch the images needed at first reveal; postcards remain on demand. */
export const WORLD_PREFETCH_IMAGES=[
  WORLD_ASSETS.panorama,WORLD_ASSETS.valley,WORLD_ASSETS.escarpment,
  WORLD_ASSETS.shoreForest,WORLD_ASSETS.billboard,WORLD_ASSETS.boardMaterials,
];
