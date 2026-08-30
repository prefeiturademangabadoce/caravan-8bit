// Salt-Scoured Field Manual: React remains invisible; this full-screen canvas frames a tactile, low-resolution desert crossing.

import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: false,
    });
    engine.setHardwareScalingLevel(2);

    let handle: GameHandle | null = null;
    let disposed = false;

    createGameScene(engine, canvas)
      .then((gameHandle) => {
        if (disposed) {
          gameHandle.dispose();
          return;
        }
        handle = gameHandle;
        engine.runRenderLoop(() => gameHandle.scene.render());
      })
      .catch((error) => {
        console.error("Caravan failed to start:", error);
        const diagnostic = document.createElement("div");
        diagnostic.id = "caravan-startup-error";
        diagnostic.textContent = `CARAVAN STARTUP FAILURE — ${String(error)}`;
        document.body.appendChild(diagnostic);
      });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      document.getElementById("caravan-startup-error")?.remove();
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Caravan isometric desert game"
      className="fixed inset-0 h-full w-full outline-none"
      style={{ touchAction: "none", imageRendering: "pixelated" }}
    />
  );
}
