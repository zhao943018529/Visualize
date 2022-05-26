import * as Three from "three";

export const createScene = () => {
  const scene = new Three.Scene();

  const planeSize = 40;
  const loader = new Three.TextureLoader();
  const texture = loader.load(require("../../../assets/normal.png").default);
  texture.wrapS = Three.RepeatWrapping;
  texture.wrapT = Three.RepeatWrapping;
  texture.magFilter = Three.NearestFilter;
  texture.repeat.set(planeSize / 2, planeSize / 2);

  const planeMat = new Three.MeshPhongMaterial({
    map: texture,
    side: Three.DoubleSide,
  });
  const planeGeo = new Three.PlaneBufferGeometry(planeSize, planeSize);
  const planeMesh = new Three.Mesh(planeGeo, planeMat);
  planeMesh.rotation.x = Math.PI * -0.5;
  scene.add(planeMesh);
  const cubeMat = new Three.MeshPhongMaterial({
    color: "#8AC",
  });
  const cubeGeo = new Three.BoxBufferGeometry(4, 4, 4);
  const cubeMesh = new Three.Mesh(cubeGeo, cubeMat);
  cubeMesh.position.set(5, 2.5, 0);
  scene.add(cubeMesh);
  const sphereMat = new Three.MeshPhongMaterial({ color: "#CA8" });
  const sphereGeo = new Three.SphereBufferGeometry(3, 32, 16);
  const sphereMesh = new Three.Mesh(sphereGeo, sphereMat);
  sphereMesh.position.set(-4, 5, 0);
  scene.add(sphereMesh);

  return scene;
};
