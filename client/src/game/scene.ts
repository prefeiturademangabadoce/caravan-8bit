// Salt-Scoured Field Manual scene: an orthographic sun-baked map is filtered into a coarse console-era desert without soft modern gloss.

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Effect } from "@babylonjs/core/Materials/effect";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { GameWorld } from "./GameWorld";

export interface GameHandle {
  scene: Scene;
  dispose(): void;
}

Effect.ShadersStore.caravanDitherFragmentShader = `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform vec2 screenSize;
  float bayer(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    float values[16];
    values[0]=0.0; values[1]=8.0; values[2]=2.0; values[3]=10.0;
    values[4]=12.0; values[5]=4.0; values[6]=14.0; values[7]=6.0;
    values[8]=3.0; values[9]=11.0; values[10]=1.0; values[11]=9.0;
    values[12]=15.0; values[13]=7.0; values[14]=13.0; values[15]=5.0;
    return values[int(i)] / 16.0;
  }
  void main(void) {
    vec2 steppedUv = floor(vUV * screenSize / 2.0) * 2.0 / screenSize;
    vec4 color = texture2D(textureSampler, steppedUv);
    float noise = (bayer(gl_FragCoord.xy) - 0.5) / 18.0;
    color.rgb = floor(clamp(color.rgb + noise, 0.0, 1.0) * 7.0) / 7.0;
    gl_FragColor = color;
  }
`;

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
  const post = new PostProcess(
    "caravan-dither",
    "caravanDither",
    ["screenSize"],
    null,
    1.0,
    camera,
    Texture.NEAREST_SAMPLINGMODE,
    engine,
  );
  post.onApply = (effect) => effect.setFloat2("screenSize", engine.getRenderWidth(), engine.getRenderHeight());

  const resizeObserver = () => setFrustum();
  window.addEventListener("resize", resizeObserver);
  scene.onBeforeRenderObservable.add(() => world.update(scene.getEngine().getDeltaTime() / 1000));

  return {
    scene,
    dispose() {
      window.removeEventListener("resize", resizeObserver);
      world.dispose();
      post.dispose(camera);
      scene.dispose();
    },
  };
}
