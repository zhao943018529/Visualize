import React, { useRef, useState, useCallback, useEffect } from "react";
import * as twgl from "twgl.js";
import { Slider, Box } from "@mui/material";
import { matIV, qtnIV, torus, sphere, cube } from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mvpMatrix;
    uniform mat4 invMatrix;
    uniform vec3 lightDirection;
    uniform vec3 eyeDirection;
    uniform vec4 ambientColor;

    varying vec4 vColor;

    void main() {
       vec3 invLightDirection = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
       vec3 invEyeDirection = normalize(invMatrix * vec4(eyeDirection, 0.0)).xyz;
       vec3 halfDirection = normalize(invEyeDirection + invLightDirection);
       float diffuse = clamp(dot(invLightDirection, normal), 0.0, 1.0);
       float specular = pow(clamp(dot(halfDirection, normal), 0.0, 1.0), 50.0);
       vec4 amb = color * ambientColor;
       vColor = amb * vec4(vec3(diffuse), 1.0) + vec4(vec3(specular), 1.0);

       gl_Position = mvpMatrix * vec4(position, 1.0); 
    }
`;

const fragmentStr = `
    precision mediump float;

    varying vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

const SCENE_VERTEX_ID = "scene-vertex-id";
const SCENE_FRAGMENT_ID = "scene-fragment-id";

const sceneVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mMatrix;
    uniform mat4 mvpMatrix;

    varying vec3 vPosition;
    varying vec4 vColor;
    varying vec3 vNormal;

    void main() {
        vPosition = (mMatrix * vec4(position, 1.0)).xyz;
        vNormal = (mMatrix * vec4(normal, 0.0)).xyz;
        vColor = color;
        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;

const sceneFragmentStr = `
    precision mediump float;

    uniform bool reflectFlag;
    uniform samplerCube cubeTexture;
    uniform vec3 eyePosition;

    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vec3 ref;
        if(reflectFlag){
            ref = reflect(vPosition - eyePosition, vNormal);
        }else{
            ref = vNormal;
        }

        vec4 envColor = textureCube(cubeTexture, ref);
        vec4 destColor = vColor * envColor;
        gl_FragColor = destColor;
    }
    
`;

// キューブマップテクスチャを生成する関数
// function create_cube_texture(
//   gl: WebGLRenderingContext,
//   source: string[],
//   target: number[]
// ) {
//   // インスタンス用の配列
//   var cImg = new Array();

//   for (var i = 0; i < source.length; i++) {
//     // インスタンスの生成
//     cImg[i] = new cubeMapImage();

//     // イメージオブジェクトのソースを指定
//     cImg[i].data.src = source[i];
//   }

//   // キューブマップ用イメージのコンストラクタ
//   function cubeMapImage() {
//     // イメージオブジェクトを格納
//     this.data = new Image();

//     // イメージロードをトリガーにする
//     this.data.onload = function () {
//       // プロパティを真にする
//       this.imageDataLoaded = true;

//       // チェック関数を呼び出す
//       checkLoaded();
//     };
//   }

//   // イメージロード済みかチェックする関数
//   function checkLoaded() {
//     // 全てロード済みならキューブマップを生成する関数を呼び出す
//     if (
//       cImg[0].data.imageDataLoaded &&
//       cImg[1].data.imageDataLoaded &&
//       cImg[2].data.imageDataLoaded &&
//       cImg[3].data.imageDataLoaded &&
//       cImg[4].data.imageDataLoaded &&
//       cImg[5].data.imageDataLoaded
//     ) {
//       generateCubeMap();
//     }
//   }

//   // キューブマップを生成する関数
//   function generateCubeMap() {
//     // テクスチャオブジェクトの生成
//     var tex = gl.createTexture();

//     // テクスチャをキューブマップとしてバインドする
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);

//     // ソースを順に処理する
//     for (var j = 0; j < source.length; j++) {
//       // テクスチャへイメージを適用
//       gl.texImage2D(
//         target[j],
//         0,
//         gl.RGBA,
//         gl.RGBA,
//         gl.UNSIGNED_BYTE,
//         cImg[j].data
//       );
//     }

//     // ミップマップを生成
//     gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

//     // テクスチャパラメータの設定
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

//     // キューブマップテクスチャを変数に代入
//     cubeTexture = tex;

//     // テクスチャのバインドを無効化
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
//   }
// }

/**
 * 通过
 * 实现步骤：
 *   1.首先创建framebuffer 绑定textureCube
 *   2.加载完图片后将对六个面分别进行投影将投影后的数据存储在texture里面
 *   3.然后再生成一遍场景，场景试图去根据帧缓存折射去获取对应的纹理
 */

export default function Refraction() {
  const glRef = useRef<WebGLRenderingContext>();
  const programInfosRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const cavRef = useRef<HTMLCanvasElement>(null);
  const qmatRef = useRef<{ [key: string]: any }>({});
  const texturesRef = useRef<{ [key: string]: WebGLTexture }>({});
  const timeRef = useRef<number>(0);
  const rotationsRef = useRef<number[]>([0, 0, 0]);
  const geometriesRef = useRef<{ [key: string]: twgl.BufferInfo }>({});
  const frameInfoRef = useRef<{ [key: string]: any }>({});

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { q, qt } = qmatRef.current;

    let cw = cavElem.width;
    let ch = cavElem.height;
    let wh = 1 / Math.sqrt(cw * cw + ch * ch);
    let x = e.clientX - cavElem.offsetLeft - cw * 0.5;
    let y = e.clientY - cavElem.offsetTop - ch * 0.5;
    let sq = Math.sqrt(x * x + y * y);
    let r = sq * 2.0 * Math.PI * wh;
    if (sq != 1) {
      sq = 1 / sq;
      x *= sq;
      y *= sq;
    }
    q.rotate(r, [y, x, 0.0], qt);
  };

  const render = useCallback((time: number) => {
    time *= 0.001;
    const deltaTime = time - timeRef.current;
    timeRef.current = time;
    const rotations = rotationsRef.current;
    rotations[1] += 1.2 * deltaTime;
    rotations[2] += deltaTime;
    const gl = glRef.current as WebGLRenderingContext;
    const { fProgramInfo, rProgramInfo } = programInfosRef.current;
    const { q, qt } = qmatRef.current;
    const { cubeTexture } = texturesRef.current;
    const { frameBuffer, fTexture, renderBuffer } = frameInfoRef.current;
    const { cubeBufferInfo, torusBufferInfo, sphereBufferInfo } =
      geometriesRef.current;

    const { width, height } = gl.canvas;
    const cubeTarget = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        eye: [1, 0, 0],
        camUp: [0, -1, 0],
        pos: [6, 0, 0],
        amb: [1.0, 0.5, 0.5, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        eye: [0, 1, 0],
        camUp: [0, 0, 1],
        pos: [0, 6, 0],
        amb: [0.5, 1.0, 0.5, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        eye: [0, 0, 1],
        camUp: [0, -1, 0],
        pos: [0, 0, 6],
        amb: [0.5, 0.5, 1.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        eye: [-1, 0, 0],
        camUp: [0, -1, 0],
        pos: [-6, 0, 0],
        amb: [0.5, 0.0, 0.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        eye: [0, -1, 0],
        camUp: [0, 0, -1],
        pos: [0, -6, 0],
        amb: [0.0, 0.5, 0.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        eye: [0, 0, -1],
        camUp: [0, -1, 0],
        pos: [0, 0, -6],
        amb: [0.0, 0.0, 0.5, 1.0],
      },
    ];

    const eyePosition = [0.0, 0.0, 20.0];
    const lightDirection = [-1.0, 1.0, 1.0];

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, 512, 512);
    cubeTarget.forEach(({ target, eye, camUp, amb, pos }) => {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        target,
        fTexture,
        0
      );
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const cameraMatrix = m4.lookAt([0, 0, 0], eye, camUp);
      const viewMatrix = m4.inverse(cameraMatrix);
      const fieldOfViewRadians = deg2radians(90);
      const perspectiveMatrix = m4.perspective(
        fieldOfViewRadians,
        1.0,
        0.1,
        200
      );
      const vpMatrix = m4.multiply(perspectiveMatrix, viewMatrix);

      let worldMatrix = m4.scaling([100.0, 100.0, 100.0]);
      let mvpMatrix = m4.multiply(vpMatrix, worldMatrix);
      gl.useProgram(rProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, rProgramInfo, cubeBufferInfo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
      twgl.setUniforms(rProgramInfo, {
        mvpMatrix,
        mMatrix: worldMatrix,
        cubeTexture,
        reflectFlag: false,
        eyePosition: [0, 0, 0],
      });
      twgl.drawBufferInfo(gl, cubeBufferInfo);

      const invEye = [-eye[0], -eye[1], -eye[2]];
      gl.useProgram(fProgramInfo.program);
      let mMatrix = m4.translation(pos);
      mMatrix = m4.axisRotate(mMatrix, eye, rotations[1]);
      //   mMatrix = m4.rotateY(mMatrix, rotations[1]);
      //   mMatrix = m4.rotateZ(mMatrix, rotations[2]);
      mvpMatrix = m4.multiply(vpMatrix, mMatrix);
      let invMatrix = m4.inverse(mMatrix);
      twgl.setBuffersAndAttributes(gl, fProgramInfo, torusBufferInfo);
      twgl.setUniforms(fProgramInfo, {
        invMatrix,
        eyeDirection: invEye,
        mvpMatrix,
        ambientColor: amb,
        lightDirection,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.0, 1.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, width, height);

    let camUpDirection = [0.0, 1.0, 0.0];
    q.toVecIII([0.0, 0.0, 20.0], qt, eyePosition);
    q.toVecIII([0.0, 1.0, 0.0], qt, camUpDirection);
    const cameraMatrix = m4.lookAt(eyePosition, [0, 0, 0], camUpDirection);
    const viewMatrix = m4.inverse(cameraMatrix);
    const aspect = width / height;
    const perspectiveMatrix = m4.perspective(deg2radians(45), aspect, 0.1, 200);
    let vpMatrix = m4.multiply(perspectiveMatrix, viewMatrix);

    gl.useProgram(rProgramInfo.program);
    let mMatrix = m4.scaling([100.0, 100.0, 100.0]);
    let mvpMatrix = m4.multiply(vpMatrix, mMatrix);
    twgl.setBuffersAndAttributes(gl, rProgramInfo, cubeBufferInfo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
    twgl.setUniforms(rProgramInfo, {
      mvpMatrix,
      mMatrix,
      reflectFlag: false,
      cubeTexture: cubeTexture,
      eyePosition,
    });
    twgl.drawBufferInfo(gl, cubeBufferInfo);

    mMatrix = m4.identity();
    mvpMatrix = m4.multiply(vpMatrix, mMatrix);
    twgl.setBuffersAndAttributes(gl, rProgramInfo, sphereBufferInfo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, fTexture);
    twgl.setUniforms(rProgramInfo, {
      mvpMatrix,
      mMatrix,
      reflectFlag: true,
      cubeTexture: fTexture,
      eyePosition,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    gl.useProgram(fProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, fProgramInfo, torusBufferInfo);
    // 画六个面对应的torus
    cubeTarget.forEach(({ pos, eye, amb }) => {
      mMatrix = m4.translation(pos);
      mMatrix = m4.axisRotate(mMatrix, eye, rotations[1]);

      mvpMatrix = m4.multiply(vpMatrix, mMatrix);
      let invMatrix = m4.inverse(mMatrix);
      twgl.setUniforms(fProgramInfo, {
        mvpMatrix,
        invMatrix,
        eyePosition: eyePosition,
        ambientColor: amb,
        lightDirection,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);
    });
    gl.flush();

    requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    // 初始化wegl数据
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const sceneProgramInfo = twgl.createProgramInfo(gl, [
      SCENE_VERTEX_ID,
      SCENE_FRAGMENT_ID,
    ]);

    programInfosRef.current = {
      fProgramInfo: programInfo,
      rProgramInfo: sceneProgramInfo,
    };
    const q = new qtnIV();
    qmatRef.current = {
      q,
      qt: q.identity(q.create()),
    };

    const cubeTexture = twgl.createTexture(gl, {
      target: gl.TEXTURE_CUBE_MAP,
      src: [
        "/pos-x.jpg",
        "/neg-x.jpg",
        "/pos-y.jpg",
        "/neg-y.jpg",
        "/pos-z.jpg",
        "/neg-z.jpg",
      ],
    });
    texturesRef.current = { cubeTexture };

    const cubeTarget = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    const fBufferWidth = 512;
    const fBufferHeight = 512;
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const depthRenderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      fBufferWidth,
      fBufferHeight
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthRenderBuffer
    );
    const fTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, fTexture);
    for (let i = 0; i < cubeTarget.length; ++i) {
      gl.texImage2D(
        cubeTarget[i],
        0,
        gl.RGBA,
        fBufferWidth,
        fBufferHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    frameInfoRef.current = {
      frameBuffer,
      renderBuffer: depthRenderBuffer,
      fTexture,
    };

    const cubeData = cube(2.0, [1.0, 1.0, 1.0, 1.0]);
    const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: cubeData.p,
        numComponents: 3,
      },
      indices: {
        data: cubeData.i,
        numComponents: 3,
      },
      normal: {
        data: cubeData.n,
        numComponents: 3,
      },
      color: {
        data: cubeData.c,
        numComponents: 4,
      },
    });
    const torusData = torus(64, 64, 0.5, 1.0, [1.0, 1.0, 1.0, 1.0]);
    const torusBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: torusData.p,
        numComponents: 3,
      },
      indices: {
        data: torusData.i,
        numComponents: 3,
      },
      normal: {
        data: torusData.n,
        numComponents: 3,
      },
      color: {
        data: torusData.c,
        numComponents: 4,
      },
    });
    const sphereData = sphere(64, 64, 3.0, [1.0, 1.0, 1.0, 1.0]);
    const sphereBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: sphereData.p,
        numComponents: 3,
      },
      indices: {
        data: sphereData.i,
        numComponents: 3,
      },
      normal: {
        data: sphereData.n,
        numComponents: 3,
      },
      color: {
        data: sphereData.c,
        numComponents: 4,
      },
    });

    geometriesRef.current = {
      cubeBufferInfo,
      torusBufferInfo,
      sphereBufferInfo,
    };

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMove}
      />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={SCENE_VERTEX_ID} type="notjs">
        {sceneVertexStr}
      </script>
      <script id={SCENE_FRAGMENT_ID} type="notjs">
        {sceneFragmentStr}
      </script>
    </Box>
  );
}
