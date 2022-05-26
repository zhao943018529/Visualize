import React, { useRef, useState, useCallback, useEffect } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { matIV, qtnIV, torus, sphere, cube } from "../../utils/minMatrixb";

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const VERTEX_ID = "main-vertex-id";
const FRAGMENT_ID = "main-fragment-id";

const vertexStr = `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec4 color;

  uniform mat4 vpMatrix;
  uniform mat4 mMatrix;
  uniform mat4 invMatrix;
  uniform vec3 eyePosition;
  uniform vec3 lightDirection;
  uniform bool mirror;
  uniform vec4 ambientColor;

  varying vec4 vColor;

  void main() {
    vec3 invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
    vec3 invEye = normalize(invMatrix * vec4(eyePosition, 0.0)).xyz;
    vec3 halfLE = normalize(invLight + invEye);
    float diffuse = clamp(dot(invLight, normal), 0.1, 1.0);
    float specular = pow(clamp(dot(halfLE, normal), 0.0, 1.0), 50.0);
    vColor = color * vec4(vec3(diffuse), 1.0) + vec4(vec3(specular), 1.0) + ambientColor;

    vec4 pos = mMatrix * vec4(position, 1.0);
    if(mirror){
      pos = vec4(pos.x, -pos.y, pos.zw);
    }
    gl_Position = vpMatrix * pos;
  }

`;
const fragmentStr = `
  precision mediump float;


  varying vec4 vColor;

  void main() {
    gl_FragColor = vColor;
  }
`;

const MIRROR_VERTEX_ID = "mirror-vertex-id";
const MIRROR_FRAGMENT_ID = "mirror-fragment-id";

const mirrorVertexStr = `
  attribute vec3 position;
  attribute vec2 texCoord;

  uniform mat4 ortMatrix;

  varying vec2 vTexCoord;

  void main() {
    vTexCoord = texCoord;
    gl_Position = ortMatrix * vec4(position, 1.0);
  }
`;

const mirrorFragmentStr = `
  precision mediump float;

  uniform sampler2D texture;
  uniform float alpha;
  varying vec2 vTexCoord;

  void main() {
    vec2 tc = vec2(vTexCoord.s, 1.0 - vTexCoord.t);
    gl_FragColor = vec4(texture2D(texture, tc).rgb, alpha);
  }
`;

function createFramebuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number
) {
  const framebuffer = gl.createFramebuffer() as WebGLFramebuffer;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const depthRenderBuffer = gl.createRenderbuffer() as WebGLRenderbuffer;
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    depthRenderBuffer
  );

  const fTexture = gl.createTexture() as WebGLTexture;
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    fTexture,
    0
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { f: framebuffer, d: depthRenderBuffer, t: fTexture, width, height };
}

interface FrameBufferInfo {
  f: WebGLFramebuffer;
  d: WebGLRenderbuffer;
  t: WebGLTexture;
  width: number;
  height: number;
}

export default function Mirror() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const matRef = useRef<{ [key: string]: any }>({});
  const glRef = useRef<WebGLRenderingContext>();
  const programInfosRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const frameBufferInfosRef = useRef<{ [key: string]: FrameBufferInfo }>({});
  const geometriesRef = useRef<{ [key: string]: twgl.BufferInfo }>({});
  const timeRef = useRef<number>(0);
  const rotationsRef = useRef<number[]>([0, 0, 0]);
  const [alpha, setAlpha] = useState<number>(50);
  const alphaRef = useRef<number>(alpha);

  const handleChange = useCallback((evt, val: any) => {
    setAlpha(val);
    alphaRef.current = val;
  }, []);

  const handleMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { q, qt } = matRef.current;
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
  }, []);

  const render = useCallback((time: number) => {
    time *= 0.001;
    const deltaTime = time - timeRef.current;
    timeRef.current = time;
    const rotations = rotationsRef.current;
    rotations[1] += 0.8 * deltaTime;
    rotations[2] += deltaTime;
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { width, height } = cavElem;
    const gl = glRef.current as WebGLRenderingContext;
    const { fb1 } = frameBufferInfosRef.current;
    const { programInfo, mirrorProgramInfo } = programInfosRef.current;
    const { torusBufferInfo, sphereBufferInfo, planeBufferInfo } =
      geometriesRef.current;
    const {
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      tmpMatrix,
      invMatrix,
      ortMatrix,
      q,
      qt,
    } = matRef.current;

    let lightDirection = [-0.577, 0.577, 0.577];
    const ambientColor = [0.0, 0.0, 0.0, 0.0];

    const eyePosition = [0.0, 5.0, 5.0];
    const camUpDirection = [0.0, 1.0, -1.0];
    const target = [0, 0, 0];

    const upDown = (rotations[1] % 10) * 0.125;

    q.toVecIII(eyePosition, qt, eyePosition);
    q.toVecIII(camUpDirection, qt, camUpDirection);

    m.lookAt(eyePosition, target, camUpDirection, vMatrix);
    m.perspective(45, width / height, 0.1, 50, pMatrix);

    m.multiply(pMatrix, vMatrix, tmpMatrix);

    // 正射影用の座標変換行列
    m.lookAt([0.0, 0.0, 0.5], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
    m.ortho(-1.0, 1.0, 1.0, -1.0, 0.1, 1, pMatrix);
    m.multiply(pMatrix, vMatrix, ortMatrix);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb1.f);
    gl.viewport(0, 0, fb1.width, fb1.height);
    gl.clearColor(0.3, 0.9, 0.9, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    gl.disable(gl.STENCIL_TEST);

    gl.cullFace(gl.FRONT);
    // 渲染圆环
    twgl.setBuffersAndAttributes(gl, programInfo, torusBufferInfo);
    m.identity(mMatrix);
    m.rotate(mMatrix, rotations[1], [0.0, 1.0, 0.0], mMatrix);
    m.translate(mMatrix, [0.0, 0.75 + upDown, 0.0], mMatrix);
    m.rotate(mMatrix, Math.PI * 0.5, [1.0, 0.0, 0.0], mMatrix);
    m.inverse(mMatrix, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix,
      invMatrix,
      vpMatrix: tmpMatrix,
      eyePosition,
      mirror: true,
      lightDirection,
      ambientColor,
    });
    twgl.drawBufferInfo(gl, torusBufferInfo);

    twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
    m.identity(mMatrix);
    m.rotate(mMatrix, -rotations[1], [0.0, 1.0, 0.0], mMatrix);
    m.translate(mMatrix, [0.0, 0.75, 1.0], mMatrix);
    m.inverse(mMatrix, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix,
      invMatrix,
      tmpMatrix,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.0, 0.7, 0.7, 1.0);
    gl.clearDepth(1.0);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    // 首先打开stencil_test,然后渲染圆环和球体，将渲染平面的stencil设置为1,
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 0, ~0);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    gl.cullFace(gl.BACK);

    twgl.setBuffersAndAttributes(gl, programInfo, torusBufferInfo);
    m.identity(mMatrix);
    m.rotate(mMatrix, rotations[1], [0.0, 1.0, 0.0], mMatrix);
    m.translate(mMatrix, [0.0, 0.75 + upDown, 0.0], mMatrix);
    m.rotate(mMatrix, Math.PI * 0.5, [1.0, 0.0, 0.0], mMatrix);
    m.inverse(mMatrix, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix,
      invMatrix,
      vpMatrix: tmpMatrix,
      eyePosition,
      mirror: false,
      lightDirection,
      ambientColor,
    });
    twgl.drawBufferInfo(gl, torusBufferInfo);

    twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
    m.identity(mMatrix);
    m.rotate(mMatrix, -rotations[1], [0.0, 1.0, 0.0], mMatrix);
    m.translate(mMatrix, [0.0, 0.75, 1.0], mMatrix);
    m.inverse(mMatrix, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix,
      invMatrix,
      vpMatrix: tmpMatrix,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, ~0);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
    m.identity(mMatrix);
    m.rotate(mMatrix, Math.PI * 1.5, [1.0, 0.0, 0.0], mMatrix);
    m.scale(mMatrix, [2.0, 2.0, 1.0], mMatrix);
    m.inverse(mMatrix, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix,
      vpMatrix: tmpMatrix,
      invMatrix,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);

    gl.useProgram(mirrorProgramInfo.program);

    gl.stencilFunc(gl.EQUAL, 1, ~0);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    twgl.setBuffersAndAttributes(gl, mirrorProgramInfo, planeBufferInfo);
    twgl.setUniforms(mirrorProgramInfo, {
      ortMatrix,
      texture: fb1.t,
      alpha: alphaRef.current * 0.01,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);
    gl.flush();

    requestAnimationFrame(render);
  }, []);

  // 初始化场景数据
  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem, { stencil: true });
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const mirrorProgramInfo = twgl.createProgramInfo(gl, [
      MIRROR_VERTEX_ID,
      MIRROR_FRAGMENT_ID,
    ]);
    programInfosRef.current = {
      programInfo,
      mirrorProgramInfo,
    };
    const fBufferWidth = cavElem.width;
    const fBufferHeight = cavElem.height;
    const frameBufferInfo = createFramebuffer(gl, fBufferWidth, fBufferHeight);

    frameBufferInfosRef.current = {
      fb1: frameBufferInfo,
    };
    const torusData = torus(64, 64, 0.1, 0.4);
    const sphereData = sphere(64, 64, 0.25);
    const torusBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: torusData.p,
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
      indices: {
        data: torusData.i,
        numComponents: 3,
      },
    });
    const sphereBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: sphereData.p,
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
      indices: {
        data: sphereData.i,
        numComponents: 3,
      },
    });
    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: [-1.0, 1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0],
        numComponents: 3,
      },
      normal: {
        data: [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0],
        numComponents: 3,
      },
      color: {
        data: [
          0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5,
          0.5, 1.0,
        ],
        numComponents: 4,
      },
      indices: {
        data: [0, 2, 1, 1, 2, 3],
        numComponents: 3,
      },
      texCoord: {
        data: [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0],
        numComponents: 2,
      },
    });
    geometriesRef.current = {
      torusBufferInfo,
      sphereBufferInfo,
      planeBufferInfo,
    };

    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());
    const ortMatrix = m.identity(m.create());
    const q = new qtnIV();
    const qt = q.identity(q.create());

    matRef.current = {
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      tmpMatrix,
      invMatrix,
      ortMatrix,
      q,
      qt,
    };

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", width: 280 }}>
        <Slider min={0} max={100} onChange={handleChange} value={alpha} />
      </Box>
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
      <script id={MIRROR_VERTEX_ID} type="notjs">
        {mirrorVertexStr}
      </script>
      <script id={MIRROR_FRAGMENT_ID} type="notjs">
        {mirrorFragmentStr}
      </script>
    </Box>
  );
}
