import React, { useRef, useEffect } from "react";
import * as twgl from "twgl.js";
import {
  matIV,
  qtnIV,
  torus,
  sphere,
  cube,
  hsva,
} from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";

/**
 * 1.生成天空盒
 * 2.渲染四个方向上的torus
 * 3.使用四个方向上的相机分别在每个方向进行拍照保存进cube 帧缓存里面
 * 4.然后使用帧缓存的天空盒去渲染中心的cube
 */

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1600;

const SKYBOX_VERTEX_ID = "skybox-vertex-id";
const SKYBOX_FRAGMENT_ID = "skybox-fragment-id";

const skyboxVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;
    attribute vec2 texCoord;

    uniform mat4 mMatrix;
    uniform mat4 mvpMatrix;

    varying vec3 tNormal;
    varying vec3 tTangent;
    varying vec3 vPosition;
    varying vec4 vColor;
    varying vec2 vTexCoord;

    void main() {
        vPosition = (mMatrix * vec4(position, 1.0)).xyz;
        tNormal = (mMatrix * vec4(normal, 0.0)).xyz;
        tTangent = cross(tNormal, vec3(0.0, 1.0, 0.0));
        vColor = color;
        vTexCoord = texCoord;

        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;

const skyboxFragmentStr = `
    precision mediump float;

    uniform bool reflectFlag;
    uniform sampler2D normalMap;
    uniform samplerCube cubeTexture;
    uniform vec3 eyePosition;

    varying vec3 vPosition;
    varying vec3 tNormal;
    varying vec3 tTangent;
    varying vec4 vColor;
    varying vec2 vTexCoord;

    void main() {
        vec3 tBinormal = cross(tNormal, tTangent);
        mat3 mView = mat3(tTangent, tBinormal, tNormal);
        vec3 mNormal = mView * (texture2D(normalMap, vTexCoord) * 2.0 - 1.0).rgb;
        vec3 ref;
        if(reflectFlag){
            ref = reflect(vPosition - eyePosition, mNormal);
        }else{
            ref = tNormal;
        }
        vec4 envColor = textureCube(cubeTexture, ref);
        vec4 destColor = vColor * envColor;
        gl_FragColor = destColor;
    }
`;

const PREVIEW_VERTEX_ID = "preview-vertex-id";
const PREVIEW_FRAGMENT_ID = "preview-fragment-id";

const previewVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mMatrix;
    uniform mat4 invMatrix;
    uniform mat4 mvpMatrix;
    uniform vec3 lightDirection;
    uniform vec3 eyePosition;
    uniform vec4 ambient;

    varying vec4 vColor;
    
    void main() {
        vec3 invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
        vec3 invEye = normalize(invMatrix * vec4(eyePosition, 0.0)).xyz;
        vec3 halfDirection = normalize(invEye + invLight);
        float diffuse = clamp(dot(invLight, normal), 0.0, 1.0);
        float specular = pow(clamp(dot(halfDirection, normal),0.0, 1.0), 50.0);
        vec4 amb = color * ambient;
        vColor = amb * vec4(vec3(diffuse), 1.0) + vec4(vec3(specular), 1.0);

        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;

const previewFragmentStr = `
    precision mediump float;

    varying vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;
    attribute vec2 texCoord;

    uniform vec3 offset;
    
    varying  vec2 vTexCoord;

    void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position * 0.25 + offset, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    uniform sampler2D texture;
    varying vec2 vTexCoord;

    void main() {
        gl_FragColor = texture2D(texture, vTexCoord);
    }
`;

function createCubeFramebuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number
) {
  const cubeTarget = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
  ];

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const depthRenderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
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
      width,
      height,
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

  return {
    fb: framebuffer,
    fTexture,
    renderBuffer: depthRenderBuffer,
    width,
    height,
  };
}

export default function EdgeLine() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const qmtRef = useRef<{ q: qtnIV | null; qt: any }>({ q: null, qt: null });

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { q, qt } = qmtRef.current;

    if (q) {
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
    }
  };
  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const previewProgram = twgl.createProgramInfo(gl, [
      PREVIEW_VERTEX_ID,
      PREVIEW_FRAGMENT_ID,
    ]);
    const skyboxProgramInfo = twgl.createProgramInfo(gl, [
      SKYBOX_VERTEX_ID,
      SKYBOX_FRAGMENT_ID,
    ]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    const { cubeTexture, bumpTexture } = twgl.createTextures(gl, {
      cubeTexture: {
        target: gl.TEXTURE_CUBE_MAP,
        src: [
          "/pos-x.jpg",
          "/neg-x.jpg",
          "/pos-y.jpg",
          "/neg-y.jpg",
          "/pos-z.jpg",
          "/neg-z.jpg",
        ],
      },
      bumpTexture: {
        src: "/normal.png",
        mag: gl.NEAREST,
      },
    });
    // 初始化模型数据
    const cubeData = cube(1.0, [1.0, 1.0, 1.0, 1.0]);
    const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: cubeData.p,
        numComponents: 3,
      },
      texCoord: {
        data: cubeData.t,
        numComponents: 2,
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
    const offsetCoord = [
      -1.0, -1.0, -1.0, 0.0, -1.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0,
      -1.0, 1.0, 0.0, 1.0, 1.0,
    ];
    const weight = [-1.0, -1.0, -1.0, -1.0, 8.0, -1.0, -1.0, -1.0, -1.0];

    const offsets = [
      [-0.75, -0.75, 0.0],
      [-0.25, -0.75, 0.0],
      [0.25, -0.75, 0.0],
    ];
    const position = [
      -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0,
    ];
    const texCoord = [0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0];
    const index = [0, 2, 1, 2, 3, 1];

    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 3,
      },
      texCoord: {
        data: texCoord,
        numComponents: 2,
      },
      indices: {
        data: index,
        numComponents: 3,
      },
    });

    const q = new qtnIV();
    const qt = q.identity(q.create());
    qmtRef.current = {
      q,
      qt,
    };
    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());

    const CUBE_COUNT = 100;
    const cubeOffset: number[][] = [];
    const cubeScale: number[] = [];
    for (let i = 0; i < CUBE_COUNT; ++i) {
      cubeOffset.push([
        Math.random() * 20.0 - 10.0,
        Math.random() * 20.0 - 10.0,
        Math.random() * 20.0 - 10.0,
      ]);
      cubeScale.push(Math.random() + 0.5);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);

    const fBufferWidth = 1600;
    const fBuffer = createCubeFramebuffer(gl, fBufferWidth, fBufferWidth);
    let cubeFaceInfos = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        eye: [1.0, 0.0, 0.0],
        camUp: [0.0, -1.0, 0.0],
        pos: [6, 0, 0],
        amb: [1.0, 0.5, 0.5, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        eye: [0.0, 1.0, 0.0],
        camUp: [0.0, 0.0, 1.0],
        pos: [0, 6.0, 0],
        amb: [0.5, 1.0, 0.5, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        eye: [0.0, 0.0, 1.0],
        camUp: [0.0, -1.0, 0.0],
        pos: [0, 0, 6.0],
        amb: [0.5, 0.5, 1.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        eye: [-1.0, 0.0, 0.0],
        camUp: [0.0, -1.0, 0.0],
        pos: [-6.0, 0, 0.0],
        amb: [0.5, 0.0, 0.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        eye: [0.0, -1.0, 0.0],
        camUp: [0.0, 0.0, -1.0],
        pos: [0.0, -6.0, 0.0],
        amb: [0.0, 0.5, 0.0, 1.0],
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        eye: [0.0, 0.0, -1.0],
        camUp: [0.0, -1.0, 0.0],
        pos: [0.0, 0.0, -6.0],
        amb: [0.0, 0.0, 0.5, 1.0],
      },
    ];
    let uniLocation = [
      gl.getUniformLocation(skyboxProgramInfo.program, "normalMap"),
      gl.getUniformLocation(skyboxProgramInfo.program, "cubeTexture"),
    ];

    let count = 0;
    function render(time: number) {
      const rad = ((++count % 360) * Math.PI) / 180;
      const lightDirection = [-1.0, 1.0, 1.0];

      gl.bindFramebuffer(gl.FRAMEBUFFER, fBuffer.fb);
      cubeFaceInfos.forEach((faceInfo) => {
        const { eye, camUp, pos, amb, target } = faceInfo;
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          target,
          fBuffer.fTexture,
          0
        );
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        m.lookAt([0, 0, 0], eye, camUp, vMatrix);
        m.perspective(90, 1, 0.1, 200, pMatrix);
        m.multiply(pMatrix, vMatrix, tmpMatrix);

        gl.useProgram(skyboxProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, cubeBufferInfo);
        m.identity(mMatrix);
        m.scale(mMatrix, [100.0, 100.0, 100.0], mMatrix);
        m.multiply(tmpMatrix, mMatrix, mvpMatrix);

        twgl.setUniforms(skyboxProgramInfo, {
          mMatrix,
          cubeTexture,
          mvpMatrix,
          reflectFlag: false,
          eyePosition: [0, 0, 0],
        });
        twgl.drawBufferInfo(gl, cubeBufferInfo);

        gl.useProgram(previewProgram.program);
        twgl.setBuffersAndAttributes(gl, previewProgram, torusBufferInfo);
        m.identity(mMatrix);
        m.translate(mMatrix, pos, mMatrix);
        m.rotate(mMatrix, rad, eye, mMatrix);
        m.inverse(mMatrix, invMatrix);
        m.multiply(tmpMatrix, mMatrix, mvpMatrix);
        const newEyePosition = [-eye[0], -eye[1], -eye[2]];
        twgl.setUniforms(previewProgram, {
          mMatrix,
          invMatrix,
          mvpMatrix,
          lightDirection,
          ambient: amb,
          eyePosition: newEyePosition,
        });
        twgl.drawBufferInfo(gl, torusBufferInfo);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.clearColor(0.0, 1.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 接下来渲染中心反射Cube
      const camUpPosition = [0, 0, 0];
      const eyePosition = [0, 0, 0];
      q.toVecIII([0.0, 0.0, 20.0], qt, eyePosition);
      q.toVecIII([0.0, 1.0, 0.0], qt, camUpPosition);
      m.lookAt(eyePosition, [0, 0, 0], camUpPosition, vMatrix);
      m.perspective(45, gl.canvas.width / gl.canvas.height, 0.1, 200, pMatrix);
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      gl.useProgram(skyboxProgramInfo.program);

      // 渲染天空盒
      twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, cubeBufferInfo);
      m.identity(mMatrix);
      m.scale(mMatrix, [100.0, 100.0, 100.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);

      twgl.setUniforms(skyboxProgramInfo, {
        mMatrix,
        mvpMatrix,
        cubeTexture,
        reflectFlag: false,
        eyePosition,
      });
      twgl.drawBufferInfo(gl, cubeBufferInfo);

      // 渲染中心cube
      m.identity(mMatrix);
      m.scale(mMatrix, [3, 3, 3], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bumpTexture);
      gl.uniform1i(uniLocation[0], 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, fBuffer.fTexture);
      gl.uniform1i(uniLocation[1], 1);
      twgl.setUniforms(skyboxProgramInfo, {
        mMatrix,
        mvpMatrix,
        reflectFlag: true,
        // cubeTexture: fBuffer.fTexture,
        // normalMap: bumpTexture,
        eyePosition,
      });
      twgl.drawBufferInfo(gl, cubeBufferInfo);

      gl.useProgram(previewProgram.program);
      twgl.setBuffersAndAttributes(gl, previewProgram, torusBufferInfo);
      cubeFaceInfos.forEach((item, index) => {
        const { amb, pos, eye } = item;

        m.identity(mMatrix);
        m.translate(mMatrix, pos, mMatrix);
        m.rotate(mMatrix, rad, eye, mMatrix);
        m.multiply(tmpMatrix, mMatrix, mvpMatrix);
        m.inverse(mMatrix, invMatrix);
        // const newEyePosition = [-eye[0], -eye[1], -eye[2]];
        twgl.setUniforms(previewProgram, {
          mMatrix,
          invMatrix,
          mvpMatrix,
          lightDirection,
          ambient: amb,
          eyePosition,
        });
        twgl.drawBufferInfo(gl, torusBufferInfo);
      });

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const { q, qt } = qmtRef.current;
    if (q) {
      const c = cavRef.current as HTMLCanvasElement;
      var cw = c.width;
      var ch = c.height;
      var wh = 1 / Math.sqrt(cw * cw + ch * ch);
      var x = evt.clientX - c.offsetLeft - cw * 0.5;
      var y = evt.clientY - c.offsetTop - ch * 0.5;
      var sq = Math.sqrt(x * x + y * y);
      var r = sq * 2.0 * Math.PI * wh;
      if (sq != 1) {
        sq = 1 / sq;
        x *= sq;
        y *= sq;
      }
      q.rotate(r, [y, x, 0.0], qt);
    }
  };

  return (
    <div>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
      />
      <script type="notjs" id={PREVIEW_VERTEX_ID}>
        {previewVertexStr}
      </script>
      <script type="notjs" id={PREVIEW_FRAGMENT_ID}>
        {previewFragmentStr}
      </script>
      <script type="notjs" id={SKYBOX_VERTEX_ID}>
        {skyboxVertexStr}
      </script>
      <script type="notjs" id={SKYBOX_FRAGMENT_ID}>
        {skyboxFragmentStr}
      </script>
    </div>
  );
}
