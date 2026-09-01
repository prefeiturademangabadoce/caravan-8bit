// Salt-Scoured Field Manual scene: an orthographic sun-baked map is filtered into a coarse console-era desert without soft modern gloss.

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { GameWorld } from "./GameWorld";

export interface GameHandle {
  scene: Scene;
  dispose(): void;
}

// The scene intentionally avoids a custom post-process shader here. The imported GitHub
// shader was not compatible with the preview’s WebGL compiler; low-resolution geometry,
// nearest-neighbor terrain, and CSS pixelation preserve the intended period look safely.


export async function createGameScene(engine: Engine, _canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#D6B16A");
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = Color3.FromHexString("#D6B16A");
  scene.fogDensity = 0.018;

  const camera = new ArcRotateCamera("isometric-camera", -Math.PI / 4, Math.acos(1 / Math.sqrt(3)), 25, Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  scene.activeCamera = camera;
  camera.lowerRadiusLimit = 25;
  camera.upperRadiusLimit = 25;
  camera.minZ = 0.1;
  const setFrustum = () => {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const vertical = 8.4;
    camera.orthoTop = vertical;
    camera.orthoBottom = -vertical;
    camera.orthoLeft = -vertical * aspect;
    camera.orthoRight = vertical * aspect;
  };
  setFrustum();

  const sun = new DirectionalLight("desert-sun", new Vector3(-0.45, -1, 0.3), scene);
  sun.position = new Vector3(7, 12, -5);
  sun.diffuse = Color3.FromHexString("#FFE0A0");
  sun.intensity = 1.42;
  const fill = new HemisphericLight("desert-fill", new Vector3(0.1, 1, 0.2), scene);
  fill.diffuse = Color3.FromHexString("#CFAF7C");
  fill.groundColor = Color3.FromHexString("#4B3B32");
  fill.intensity = 0.72;

  const world = new GameWorld(scene);
  const resizeObserver = () => setFrustum();
  window.addEventListener("resize", resizeObserver);
  scene.onBeforeRenderObservable.add(() => world.update(scene.getEngine().getDeltaTime() / 1000));

  return {
    scene,
    dispose() {
      window.removeEventListener("resize", resizeObserver);
      world.dispose();
      scene.dispose();
    },
  };
}
