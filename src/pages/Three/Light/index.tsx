import React, { useRef, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import * as Three from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper";
import {
  matIV,
  qtnIV,
  torus,
  sphere,
  cube,
  hsva,
} from "../../../utils/minMatrixb";
import { deg2radians } from "../../../utils/math";
const { PointLight, AmbientLight, DirectionalLight, HemisphereLight } = Three;

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;

export default function LoadFile() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  const createScene = useCallback(() => {
    const scene = new Three.Scene();
    const planeSize = 40;
    const loader = new Three.TextureLoader();
    const texture = loader.load(require("../../../assets/wave.jpg").default);
    texture.wrapS = Three.RepeatWrapping;
    texture.wrapT = Three.RepeatWrapping;
    texture.magFilter = Three.NearestFilter;
    texture.repeat.set(planeSize / 2, planeSize / 2);
    let planeMat = new Three.MeshStandardMaterial({
      color: "#fff",
      side: Three.DoubleSide,
    });
    let cubeMat = new Three.MeshStandardMaterial({ color: "#8AC" });
    let sphereMat = new Three.MeshStandardMaterial({ color: "#CA8" });
    const planeGeo = new Three.PlaneBufferGeometry(planeSize, planeSize);
    const mesh = new Three.Mesh(planeGeo, planeMat);
    mesh.rotation.x = Math.PI * -0.5;
    scene.add(mesh);

    const cubeGeo = new Three.BoxBufferGeometry(4, 4, 4);
    const cubeMesh = new Three.Mesh(cubeGeo, cubeMat);
    cubeMesh.position.set(5, 2.5, 0);
    scene.add(cubeMesh);

    const sphereGeo = new Three.SphereBufferGeometry(3, 32, 16);
    const sphereMesh = new Three.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(-4, 5, 0);
    scene.add(sphereMesh);

    return scene;
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const renderer = new Three.WebGLRenderer({
      canvas: cavElem,
      logarithmicDepthBuffer: true,
    });
    const aspect = cavElem.width / cavElem.height;
    const camera = new Three.PerspectiveCamera(60, aspect, 0.1, 200);
    camera.position.set(0, 10, 20);
    const controls = new OrbitControls(camera, cavElem);
    controls.target.set(0, 5, 0);
    controls.update();

    const scene = createScene();

    // const directionalLight = new Three.DirectionalLight(0xffffff, 1);
    // directionalLight.position.set(0, 10, 0);
    // directionalLight.target.position.set(-5, 0, 0);
    // scene.add(directionalLight);
    // scene.add(directionalLight.target);
    // const hemisphereLight = new Three.HemisphereLight(0xb1e1ff, 0xb97a20, 1);
    // scene.add(hemisphereLight);
    // const hemisphereLightHelper = new Three.HemisphereLightHelper(hemisphereLight,5)
    // scene.add(hemisphereLightHelper)
    const rectAreaLight = new Three.RectAreaLight(0xffffff, 5, 12, 4);
    rectAreaLight.position.set(0, 10, 0);
    rectAreaLight.rotation.x = Three.MathUtils.degToRad(-90);
    rectAreaLight.rotation.y = Three.MathUtils.degToRad(30);
    scene.add(rectAreaLight);
    const rectAreaLightHelper = new RectAreaLightHelper(rectAreaLight);
    scene.add(rectAreaLightHelper);

    // const ambientLight = new Three.AmbientLight(0xf0f0f0, 1);
    // scene.add(ambientLight);

    const render = () => {
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
