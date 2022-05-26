import React, { useRef, useCallback, useEffect } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  LineBasicMaterial,
  Vector3,
  BufferGeometry,
  Line,
  TextGeometry,
  Color,
  DirectionalLight,
  AmbientLight,
  OrthographicCamera,
  AxesHelper,
  MeshPhongMaterial,
  TubeGeometry,
  MeshLambertMaterial,
  SpotLight,
  Texture,
  SpriteMaterial,
  Sprite,
} from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

import "./index.css";

const WIDTH = 1200;
const HEIGHT = 800;

export default function BabylonPage() {
  const divRef = useRef<HTMLDivElement>(null);

  const makeSpriteText = useCallback(() => {
    const cav = document.createElement("canvas");
    const ctx = cav.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffff00";
    ctx.font = "Bold 100px Arial";
    ctx.lineWidth = 4;
    ctx.fillText("Hello World", 4, 104);
    ctx.textAlign = "start";
    const texture = new Texture(cav);
    texture.needsUpdate = true;
    const material = new SpriteMaterial({
      color: 0xff00ff,
      map: texture,
    });
    const textObj = new Sprite(material);
    textObj.scale.set(0.5 * 50, 0.25 * 50, 0.75 * 50);
    textObj.position.set(0, 0, 98);

    return textObj;
  }, []);

  useEffect(() => {
    const scene = new Scene();
    scene.background = new Color(111, 126, 135);

    const scale = WIDTH / HEIGHT;
    const s = 200;
    const camera = new OrthographicCamera(
      -s * scale,
      s * scale,
      s,
      -s,
      1,
      1000
    );
    camera.position.set(200, 300, 200);
    camera.lookAt(scene.position);
    // const camera = new PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000);
    const renderer = new WebGLRenderer();
    renderer.setSize(WIDTH, HEIGHT);
    (divRef.current as HTMLDivElement).appendChild(renderer.domElement);
    const geometry = new BoxGeometry(3, 3, 3);
    const material = new MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new Mesh(geometry, material);
    // scene.add(cube);
    const cube1 = new Mesh(
      new BoxGeometry(10, 10, 10),
      new MeshLambertMaterial({ color: 0x00ff00 })
    );
    cube1.position.set(10, 20, -20);
    cube1.castShadow = true;
    scene.add(cube1);
    const spotLight = new SpotLight(0xffff00, 1, 100, Math.PI / 6, 25);
    spotLight.position.set(100, 200, -150);
    spotLight.target = cube1;
    spotLight.castShadow = true;
    scene.add(spotLight);
    scene.receiveShadow = true;
    const light = new DirectionalLight(0xaabbff, 0.3);
    light.position.x = 100;
    light.position.y = 100;
    light.position.z = -100;
    scene.add(light);
    const ambient = new AmbientLight(0x444444);
    scene.add(ambient);
    const lineMaterial = new LineBasicMaterial({ color: 0x00aaff });
    const points = [];
    points.push(new Vector3(-10, 0, 0));
    points.push(new Vector3(0, 10, 0));
    points.push(new Vector3(10, 0, 0));
    points.push(new Vector3(20, 10, 0));
    const lineGeometry = new BufferGeometry().setFromPoints(points);
    const line = new Line(lineGeometry, lineMaterial);
    scene.add(line);
    const text = "ZCC";
    const loader = new OBJLoader();
    const material1 = new MeshPhongMaterial({ color: 0x44aa88 });
    const texture = makeSpriteText();
    scene.add(texture);
    // loader.setMaterials([material1]);
    loader.load(
      "/Dragon_1.obj",
      function (obj) {
        // new Mesh(obj, material);
        // scene.add(obj);
      },
      undefined,
      function (error) {
        console.error(error);
      }
    );
    camera.position.set(0, 0, 100);
    renderer.shadowMap.enabled = true;
    // scene.add(new AxesHelper(10e3));
    const controls = new OrbitControls(camera, renderer.domElement);
    function render() {
      renderer.render(scene, camera);
    }
    controls.addEventListener("change", render);
    // camera.lookAt(0, 0, 0);
    const animate = () => {
      requestAnimationFrame(animate);
      cube1.rotation.x += 0.01;
      cube1.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();
  }, []);

  return (
    <div
      ref={divRef}
      style={{ width: WIDTH + "px", height: HEIGHT + "px" }}
      className="babylon-container"
    >
      <div id="info">Description</div>
    </div>
  );
}
