import { light } from "@mui/material/styles/createPalette";
import React, { useRef, useCallback, useEffect } from "react";
import * as Three from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { createScene } from "../utils/index";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;

export default function Shadow() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const renderer = new Three.WebGLRenderer({ canvas: cavElem });
    renderer.shadowMap.enabled = true;
    const aspect = cavElem.width / cavElem.height;
    const scene = new Three.Scene();
    scene.background = new Three.Color(0x333333);
    const camera = new Three.PerspectiveCamera(45, aspect, 5, 100);
    camera.position.set(0, 10, 20);
    scene.add(camera);

    const helperCamera = new Three.PerspectiveCamera(45, aspect, 5, 100);
    helperCamera.position.set(20, 10, 20);
    helperCamera.lookAt(0, 5, 0);
    scene.add(helperCamera);

    const cameraHelper = new Three.CameraHelper(helperCamera);
    scene.add(cameraHelper);

    const controls = new OrbitControls(camera, cavElem);
    controls.target.set(0, 5, 0);
    controls.update();

    // const light = new Three.DirectionalLight(0xffffff, 1);
    // light.castShadow = true;
    // light.position.set(0, 10, 0);
    // light.target.position.set(-4, 0, 4);
    // scene.add(light);
    // scene.add(light.target);

    // const shadowCamera = light.shadow.camera;
    // shadowCamera.left = -10;
    // shadowCamera.right = 10;
    // shadowCamera.top = 10;
    // shadowCamera.bottom = -10;
    // shadowCamera.updateProjectionMatrix();

    // const lightHelper = new Three.DirectionalLightHelper(light);
    // scene.add(lightHelper);

    // const shadowHelper = new Three.CameraHelper(shadowCamera);
    // scene.add(shadowHelper);

    const spotLight = new Three.SpotLight(0xffffff, 1);
    spotLight.castShadow = true;
    spotLight.position.set(0, 10, 0);
    spotLight.target.position.set(-4, 0, 4);
    scene.add(spotLight);
    const shadowCamera = spotLight.shadow.camera;
    shadowCamera.updateProjectionMatrix();
    const lightHelper = new Three.SpotLightHelper(spotLight);
    scene.add(lightHelper);

    const shadowHelper = new Three.CameraHelper(shadowCamera);
    scene.add(shadowHelper);

    const planeSize = 40;

    const loader = new Three.TextureLoader();
    const texture = loader.load(require("../../../assets/normal.png").default);
    texture.wrapS = Three.RepeatWrapping;
    texture.wrapT = Three.RepeatWrapping;
    texture.magFilter = Three.NearestFilter;
    texture.repeat.set(planeSize / 2, planeSize / 2);
    const planeGeo = new Three.PlaneBufferGeometry(planeSize, planeSize);
    const planeMat = new Three.MeshPhongMaterial({
      map: texture,
      side: Three.DoubleSide,
    });
    const planeMesh = new Three.Mesh(planeGeo, planeMat);
    planeMesh.receiveShadow = true;
    planeMesh.rotation.x = Math.PI * -0.5;
    scene.add(planeMesh);

    const material = new Three.MeshPhongMaterial({
      color: 0x88aacc,
    });
    const boxMat = new Three.BoxBufferGeometry(4, 4, 4);
    const boxMesh = new Three.Mesh(boxMat, material);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    boxMesh.position.set(5, 3, 0);
    scene.add(boxMesh);

    const sphereMat = new Three.SphereBufferGeometry(3, 32, 16);
    const sphereMesh = new Three.Mesh(sphereMat, material);
    sphereMesh.castShadow = true;
    sphereMesh.receiveShadow = true;
    sphereMesh.position.set(-4, 5, 0);
    scene.add(sphereMesh);

    const render = () => {
      cameraHelper.update();
      lightHelper.update();
      shadowHelper.update();

      renderer.render(scene, camera);

      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
