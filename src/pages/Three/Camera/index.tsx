import React, { useRef, useCallback, useEffect } from "react";
import * as Three from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { createScene } from "../utils/index";

import "./index.css";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;

export default function Camera() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const leftDivRef = useRef<HTMLDivElement>(null);
  const rightDivRef = useRef<HTMLDivElement>(null);

  const setScissorForElement = useCallback(
    (elem: HTMLDivElement, renderer: Three.WebGLRenderer) => {
      const cavElem = cavRef.current as HTMLCanvasElement;
      const cavRect = cavElem.getBoundingClientRect();
      const elemRect = elem.getBoundingClientRect();
      const left = Math.max(elemRect.left - cavRect.left, 0);
      const right = Math.min(elemRect.right, cavRect.right) - cavRect.left;
      const top = Math.max(0, elemRect.top - cavRect.top);
      const bottom = Math.min(elemRect.bottom, cavRect.bottom) - cavRect.top;
      const width = Math.min(cavRect.width, right - left);
      const height = Math.min(cavRect.height, bottom - top);

      //将剪刀设置为仅渲染到画布的该部分
      const positiveYUpBottom = cavRect.height - bottom;
      renderer.setScissor(left, positiveYUpBottom, width, height);
      renderer.setViewport(left, positiveYUpBottom, width, height);

      //返回外观
      return width / height;
    },
    []
  );

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const renderer = new Three.WebGLRenderer({ canvas: cavElem });
    renderer.setScissorTest(true);

    const scene = createScene();

    scene.background = new Three.Color(0x0000000);
    const light = new Three.DirectionalLight(0xffffff, 1);
    light.position.set(0, 10, 0);
    light.target.position.set(5, 0, 0);
    scene.add(light);
    scene.add(light.target);

    const leftCamera = new Three.PerspectiveCamera(45, 2, 5, 100);
    leftCamera.position.set(0, 10, 20);
    const helper = new Three.CameraHelper(leftCamera);
    scene.add(helper);

    const leftControls = new OrbitControls(
      leftCamera,
      leftDivRef.current as HTMLDivElement
    );
    leftControls.target.set(0, 5, 0);
    leftControls.update();

    const rightCamera = new Three.PerspectiveCamera(60, 2, 0.1, 200);
    rightCamera.position.set(40, 10, 30);
    rightCamera.lookAt(0, 5, 0);
    const rightControls = new OrbitControls(
      rightCamera,
      rightDivRef.current as HTMLDivElement
    );
    rightControls.target.set(0, 5, 0);
    rightControls.update();

    const render = () => {
      const sceneBackground = scene.background as Three.Color;
      const leftAspect = setScissorForElement(
        leftDivRef.current as HTMLDivElement,
        renderer
      );
      leftCamera.aspect = leftAspect;
      leftCamera.updateProjectionMatrix();
      helper.update();
      helper.visible = false;

      sceneBackground.set(0x000000);
      renderer.render(scene, leftCamera);
      const rightAspect = setScissorForElement(
        rightDivRef.current as HTMLDivElement,
        renderer
      );
      rightCamera.aspect = rightAspect;
      rightCamera.updateProjectionMatrix();
      //   helper.update();
      helper.visible = true;

      sceneBackground.set(0x000040);
      renderer.render(scene, rightCamera);

      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div className="camera-split">
        <div className="split-item" ref={leftDivRef}></div>
        <div className="split-item" ref={rightDivRef}></div>
      </div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
