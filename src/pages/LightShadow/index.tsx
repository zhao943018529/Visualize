import React, { useRef, useState, useCallback, useEffect } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { matIV, qtnIV, torus, sphere, cube } from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 720;

const FRUSTUM_VERTEX_ID = "frustum-vertex-id";
const FRUSTUM_FRAGMENT_ID = "frustum-fragment-id";

const frustumVertexStr = `
    attribute vec3 position;

    uniform mat4 u_world;
    uniform mat4 u_view;
    uniform mat4 u_projection;

    void main(){
        gl_Position = u_projection * u_view * u_world * vec4(position, 1.0);
    }
`;
const frustumFragmentStr = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }   
`;

const DEPTH_VERTEX_ID = "depth-vertex";
const DEPTH_FRAGMENT_ID = "depth-fragment";

const depthVertexStr = `
    attribute vec3 position;
    
    uniform mat4 mvpMatrix;

    varying vec4 vPosition;

    void main(){
        vPosition = mvpMatrix * vec4(position, 1.0);
        gl_Position = vPosition;
    }
`;
const depthFragmentStr = `
    precision mediump float;

    varying vec4 vPosition;

    vec4 convRGBA(float depth){
        float r = depth;
        float g = fract(r * 255.0);
        float b = fract(g * 255.0);
        float a = fract(b * 255.0);
        float coef = 1.0 / 255.0;
        r -= g * coef;
        g -= b * coef;
        b -= a * coef;
        return vec4(r, g, b, a);
    }

    void main() {
       gl_FragColor= convRGBA(vPosition.z / vPosition.w);
    }
`;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mMatrix;
    uniform mat4 mvpMatrix;
    uniform mat4 tMatrix;
    uniform mat4 lgtMatrix;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec4 vColor;
    varying vec4 vTexCoord;
    varying vec4 vDepth;

    void main(void) {
        vPosition = (mMatrix * vec4(position, 1.0)).xyz;
        vNormal = normal;
        vColor = color;
        vTexCoord = tMatrix * vec4(vPosition, 1.0);
        vDepth = lgtMatrix * vec4(position, 1.0);
        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform mat4      invMatrix;
    uniform vec3      lightPosition;
    uniform sampler2D texture;
    uniform bool      depthBuffer;
    varying vec3      vPosition;
    varying vec3      vNormal;
    varying vec4      vColor;
    varying vec4      vTexCoord;
    varying vec4      vDepth;

    float restDepth(vec4 RGBA){
        const float rMask = 1.0;
        const float gMask = 1.0 / 255.0;
        const float bMask = 1.0 / (255.0 * 255.0);
        const float aMask = 1.0 / (255.0 * 255.0 * 255.0);
        float depth = dot(RGBA, vec4(rMask, gMask, bMask, aMask));
        return depth;
    }

    void main() {
        vec3  light     = lightPosition - vPosition;
        vec3  invLight  = normalize(invMatrix * vec4(light, 0.0)).xyz;
        float diffuse   = clamp(dot(vNormal, invLight), 0.2, 1.0);
        float shadow    = restDepth(texture2DProj(texture, vTexCoord));
        vec4 depthColor = vec4(1.0);
        if(vDepth.w > 0.0){
            float lightCoord = vDepth.z / vDepth.w;
            if(lightCoord - 0.001 > shadow){
                depthColor  = vec4(0.5, 0.5, 0.5, 1.0);
            }
        }
        gl_FragColor = vColor * vec4(vec3(diffuse), 1.0) * depthColor;
    }
`;

function createFramebuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number
) {
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

export default function LightShadow() {
  const countRef = useRef<number>(0);
  const valueRef = useRef<number>(45);
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const timeRef = useRef<number>(0);
  const rotationsRef = useRef<number[]>([0, 0, 0]);
  const matRef = useRef<{ [key: string]: any }>({});
  const framebufferRef = useRef<{ [key: string]: any }>({});
  const programInfosRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const configRef = useRef<{ [key: string]: any }>({
    lightPosition: [0.0, 1.0, 0.0],
    lightUpDirection: [0.0, 0.0, -1.0],
    eyePosition: [0.0, 70.0, 0.0],
    camUpDirection: [0.0, 0.0, -1.0],
  });
  const [rangeVal, setRangeVal] = useState<number>(valueRef.current);
  const geometriesRef = useRef<{ [key: string]: twgl.BufferInfo }>({});

  const [value, setValue] = useState<number>(30);

  const handleChange = (event: Event, val: number | number[]) => {
    setRangeVal(val as number);
    valueRef.current = val as number;
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const render = useCallback((time: number) => {
    time *= 0.001;
    const deltaTime = time - timeRef.current;
    timeRef.current = time;
    const rotations = rotationsRef.current;
    rotations[1] += 1.2 * deltaTime;
    rotations[2] += deltaTime;
    const gl = glRef.current as WebGLRenderingContext;
    const { torusBufferInfo, planeBufferInfo, frustumBufferInfo } =
      geometriesRef.current;
    const {
      depth: depthProgramInfo,
      view: viewProgramInfo,
      frustum: frustumProgramInfo,
    } = programInfosRef.current;
    const { f, d, t, width, height } = framebufferRef.current;
    const {
      q,
      qt,
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      tmpMatrix,
      mvpMatrix,
      invMatrix,
      tMatrix,
      lgtMatrix,
      dvMatrix,
      dpMatrix,
      dvpMatrix,
      invdpMatrix,
      invdvMatrix,
    } = matRef.current;
    /**
     * 1.先计算当前观察点的矩阵
     */
    const cavWidth = gl.canvas.width;
    const cavHeight = gl.canvas.height;
    const eyePosition = [0.0, 70.0, 0.0];
    const camUpDirection = [0.0, 0.0, -1.0];
    q.toVecIII(eyePosition, qt, eyePosition);
    q.toVecIII(camUpDirection, qt, camUpDirection);
    m.lookAt(eyePosition, [0, 0, 0], camUpDirection, vMatrix);
    m.perspective(45, cavWidth / cavHeight, 0.1, 1000, pMatrix);
    m.multiply(pMatrix, vMatrix, tmpMatrix);

    m.identity(tMatrix);
    tMatrix[0] = 0.5;
    tMatrix[1] = 0.0;
    tMatrix[2] = 0.0;
    tMatrix[3] = 0.0;
    tMatrix[4] = 0.0;
    tMatrix[5] = 0.5;
    tMatrix[6] = 0.0;
    tMatrix[7] = 0.0;
    tMatrix[8] = 0.0;
    tMatrix[9] = 0.0;
    tMatrix[10] = 1.0;
    tMatrix[11] = 0.0;
    tMatrix[12] = 0.5;
    tMatrix[13] = 0.5;
    tMatrix[14] = 0.0;
    tMatrix[15] = 1.0;
    const rVal = valueRef.current;
    let lightPosition = [0.0 * rVal, 1.0 * rVal, 0.0 * rVal];
    m.lookAt(lightPosition, [0, 0, 0], [0.0, 0.0, -1.0], dvMatrix);
    m.perspective(90, 1.0, 0.1, 150, dpMatrix);
    m.multiply(tMatrix, dpMatrix, dvpMatrix);
    m.multiply(dvpMatrix, dvMatrix, tMatrix);

    m.multiply(dpMatrix, dvMatrix, dvpMatrix);

    gl.useProgram(depthProgramInfo.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0.0, 0.0, width, height);

    twgl.setBuffersAndAttributes(gl, depthProgramInfo, torusBufferInfo);
    for (let i = 0; i < 10; ++i) {
      const rad2 = ((((i % 5) * 72) % 360) * Math.PI) / 180;
      const ifl = -Math.floor(i / 5) + 1;
      m.identity(mMatrix);
      m.rotate(mMatrix, rad2, [0.0, 1.0, 0.0], mMatrix);
      m.translate(
        mMatrix,
        [0.0, ifl * 10.0 + 10.0, (ifl - 2.0) * 7.0],
        mMatrix
      );
      m.rotate(mMatrix, rotations[1], [1.0, 1.0, 0.0], mMatrix);
      m.multiply(dvpMatrix, mMatrix, lgtMatrix);
      twgl.setUniforms(depthProgramInfo, {
        mvpMatrix: lgtMatrix,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);
    }
    twgl.setBuffersAndAttributes(gl, depthProgramInfo, planeBufferInfo);
    m.identity(mMatrix);
    m.translate(mMatrix, [0.0, -10.0, 0.0], mMatrix);
    m.scale(mMatrix, [30.0, 0.0, 30.0], mMatrix);
    m.multiply(dvpMatrix, mMatrix, lgtMatrix);

    twgl.setUniforms(depthProgramInfo, {
      mvpMatrix: lgtMatrix,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);

    gl.useProgram(viewProgramInfo.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, t);

    gl.clearColor(0.0, 0.7, 0.7, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    twgl.setBuffersAndAttributes(gl, viewProgramInfo, torusBufferInfo);
    for (let i = 0; i < 10; ++i) {
      const rad2 = ((((i % 5) * 72) % 360) * Math.PI) / 180;
      const ifl = -Math.floor(i / 5) + 1;
      m.identity(mMatrix);
      m.rotate(mMatrix, rad2, [0.0, 1.0, 0.0], mMatrix);
      m.translate(
        mMatrix,
        [0.0, ifl * 10.0 + 10.0, (ifl - 2.0) * 7.0],
        mMatrix
      );
      m.rotate(mMatrix, rotations[1], [1.0, 1.0, 0.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);
      m.inverse(mMatrix, invMatrix);
      m.multiply(dvpMatrix, mMatrix, lgtMatrix);
      twgl.setUniforms(viewProgramInfo, {
        mMatrix,
        tMatrix,
        lgtMatrix,
        mvpMatrix,
        invMatrix,
        lightPosition,
        texture: t,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);
    }
    twgl.setBuffersAndAttributes(gl, viewProgramInfo, planeBufferInfo);
    m.identity(mMatrix);
    m.translate(mMatrix, [0.0, -10.0, 0.0], mMatrix);
    m.scale(mMatrix, [30.0, 0.0, 30.0], mMatrix);
    m.multiply(dvpMatrix, mMatrix, lgtMatrix);
    m.inverse(mMatrix, invMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    twgl.setUniforms(viewProgramInfo, {
      mMatrix,
      tMatrix,
      lgtMatrix,
      mvpMatrix,
      invMatrix,
      lightPosition,
      texture: t,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);

    gl.useProgram(frustumProgramInfo.program);
    m.identity(mMatrix);
    m.inverse(dpMatrix, invdpMatrix);
    m.inverse(dvMatrix, invdvMatrix);
    m.multiply(invdvMatrix, invdpMatrix, mMatrix);
    twgl.setBuffersAndAttributes(gl, frustumProgramInfo, frustumBufferInfo);
    twgl.setUniforms(frustumProgramInfo, {
      u_projection: pMatrix,
      u_view: vMatrix,
      u_world: mMatrix,
      u_color: [0, 0, 0, 1],
    });
    // twgl.drawBufferInfo(gl, frustumBufferInfo, gl.LINES);
    gl.drawElements(
      gl.LINES,
      frustumBufferInfo.numElements,
      gl.UNSIGNED_SHORT,
      0
    );
    gl.flush();

    requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    // 初始化矩阵，几何物体相关数据
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const depthProgramInfo = twgl.createProgramInfo(gl, [
      DEPTH_VERTEX_ID,
      DEPTH_FRAGMENT_ID,
    ]);
    const viewProgramInfo = twgl.createProgramInfo(gl, [
      VERTEX_ID,
      FRAGMENT_ID,
    ]);
    const frustumProgramInfo = twgl.createProgramInfo(gl, [
      FRUSTUM_VERTEX_ID,
      FRUSTUM_FRAGMENT_ID,
    ]);
    programInfosRef.current = {
      depth: depthProgramInfo,
      view: viewProgramInfo,
      frustum: frustumProgramInfo,
    };
    // 开启深度缓存
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    const q = new qtnIV();
    const qt = q.identity(q.create());
    var m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());
    const tMatrix = m.identity(m.create());
    const lgtMatrix = m.identity(m.create());
    const dvMatrix = m.identity(m.create());
    const dpMatrix = m.identity(m.create());
    const dvpMatrix = m.identity(m.create());
    const invdpMatrix = m.identity(m.create());
    const invdvMatrix = m.identity(m.create());
    matRef.current = {
      q,
      qt,
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      tmpMatrix,
      mvpMatrix,
      invMatrix,
      tMatrix,
      lgtMatrix,
      dvMatrix,
      dpMatrix,
      dvpMatrix,
      invdpMatrix,
      invdvMatrix,
    };
    framebufferRef.current = createFramebuffer(gl, 2048, 2048);
    const torusData = torus(64, 64, 1.0, 2.0, [1.0, 1.0, 1.0, 1.0]);
    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: [-1.0, 0.0, -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, 1.0],
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
        data: [0, 2, 1, 3, 1, 2],
        numComponents: 3,
      },
    });
    const frustumBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: [
        -1,
        -1,
        -1, //0
        1,
        -1,
        -1, //1
        -1,
        1,
        -1, //2
        1,
        1,
        -1, //3
        -1,
        -1,
        1, //4
        1,
        -1,
        1, //5
        -1,
        1,
        1, //6
        1,
        1,
        1, //7
      ],
      indices: [
        0, 1, 1, 3, 3, 2, 2, 0,

        4, 5, 5, 7, 7, 6, 6, 4,

        0, 4, 1, 5, 3, 7, 2, 6,
      ],
    });
    geometriesRef.current = {
      torusBufferInfo: twgl.createBufferInfoFromArrays(gl, {
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
      }),
      planeBufferInfo,
      frustumBufferInfo,
    };
    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", width: 320 }}>
        <Slider min={30} max={60} value={rangeVal} onChange={handleChange} />
      </Box>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMove}
      />
      <script id={DEPTH_VERTEX_ID} type="notjs">
        {depthVertexStr}
      </script>
      <script id={DEPTH_FRAGMENT_ID} type="notjs">
        {depthFragmentStr}
      </script>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={FRUSTUM_VERTEX_ID} type="notjs">
        {frustumVertexStr}
      </script>
      <script id={FRUSTUM_FRAGMENT_ID} type="notjs">
        {frustumFragmentStr}
      </script>
    </Box>
  );
}
