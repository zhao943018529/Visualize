import React, { useRef, useState, useCallback, useEffect } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { matIV, qtnIV, torus, sphere, cube } from "../../utils/minMatrixb";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;

const DEPTH_VERTEX = "depth-vertex";
const DEPTH_FRAGMENT = "depth-fragment";

const depthVertexStr = `
    attribute vec3 position;

    uniform mat4 mMatrix;
    uniform mat4 mvpMatrix;
    uniform vec3 eyePosition;

    varying vec4 vColor;

    const float near = 0.1;
    const float far = 15.0;
    const float linerDepth = 1.0 / (far - near);

    void main() {
        vec3 pos = (mMatrix * vec4(position, 1.0)).xyz;
        float depth = length(eyePosition - pos) * linerDepth;
        vColor = vec4(vec3(depth), 1.0);
        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;
const depthFragmentStr = `
    precision mediump float;

    varying vec4 vColor;

    void main(void){
        gl_FragColor = vColor;
    }    
`;

const DIFF_VERTEX = "diff-vertex";
const DIFF_FRAGMENT = "diff-fragment";

// 计算
const diffVertexStr = `
    attribute vec3 position;

    uniform mat4 mMatrix;
    uniform mat4 tMatrix;
    uniform mat4 mvpMatrix;
    uniform vec3 eyePosition;

    varying float vDepth;
    varying vec4 vTexCoord;

    const float near = 0.1;
    const float far = 15.0;
    const float linerDepth = 1.0 / (far - near);

    void main() {
        vec3 pos = (mMatrix * vec4(position, 1.0)).xyz;
        vDepth = length(eyePosition - pos) * linerDepth;
        vTexCoord = tMatrix * vec4(pos, 1.0);

        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;

const diffFragmentStr = `
    precision mediump float;

    uniform sampler2D backFaceTexture;
    varying float vDepth;
    varying vec4 vTexCoord;

    void main() {
        float bDepth = 1.0 - texture2DProj(backFaceTexture, vTexCoord).r;
        float difference = 1.0 - clamp(bDepth - vDepth, 0.0, 1.0);
        gl_FragColor = vec4(vec3(difference), 1.0);
    }
`;

const BLUR_VERTEX = "blur-vertex";
const BLUR_FRAGMENT = "blur-fragment";

function getBlurVertexFragment(width: number, height: number) {
  const blurVertexStr = `
        attribute vec3 position;
        attribute vec2 texCoord;
        
        uniform mat4 ortMatrix;
        
        varying vec4 vColor;
        varying vec2 vTexCoord;
    
        void main() {
            vTexCoord = texCoord;
            gl_Position = ortMatrix * vec4(position, 1.0);
        }
    `;

  const blurFragmentStr = `
        precision mediump float;
    
        uniform sampler2D texture;
        uniform float weight[5];
        uniform bool horizontal;
        varying vec2 vTexCoord;


        const float screenWidth = ${width}.0;
        const float tFrag = 1.0 / screenWidth;

        void main(void){
            vec2 fc = gl_FragCoord.st;
            vec3 destColor = vec3(0.0);
            if(horizontal){
                destColor += texture2D(texture, (fc + vec2(-4.0, 0.0)) * tFrag).rgb * weight[4];
                destColor += texture2D(texture, (fc + vec2(-3.0, 0.0)) * tFrag).rgb * weight[3];
                destColor += texture2D(texture, (fc + vec2(-2.0, 0.0)) * tFrag).rgb * weight[2];
                destColor += texture2D(texture, (fc + vec2(-1.0, 0.0)) * tFrag).rgb * weight[1];
                destColor += texture2D(texture, (fc + vec2( 0.0, 0.0)) * tFrag).rgb * weight[0];
                destColor += texture2D(texture, (fc + vec2( 1.0, 0.0)) * tFrag).rgb * weight[1];
                destColor += texture2D(texture, (fc + vec2( 2.0, 0.0)) * tFrag).rgb * weight[2];
                destColor += texture2D(texture, (fc + vec2( 3.0, 0.0)) * tFrag).rgb * weight[3];
                destColor += texture2D(texture, (fc + vec2( 4.0, 0.0)) * tFrag).rgb * weight[4];
            }else{
                destColor += texture2D(texture, (fc + vec2(0.0, -4.0)) * tFrag).rgb * weight[4];
                destColor += texture2D(texture, (fc + vec2(0.0, -3.0)) * tFrag).rgb * weight[3];
                destColor += texture2D(texture, (fc + vec2(0.0, -2.0)) * tFrag).rgb * weight[2];
                destColor += texture2D(texture, (fc + vec2(0.0, -1.0)) * tFrag).rgb * weight[1];
                destColor += texture2D(texture, (fc + vec2(0.0,  0.0)) * tFrag).rgb * weight[0];
                destColor += texture2D(texture, (fc + vec2(0.0,  1.0)) * tFrag).rgb * weight[1];
                destColor += texture2D(texture, (fc + vec2(0.0,  2.0)) * tFrag).rgb * weight[2];
                destColor += texture2D(texture, (fc + vec2(0.0,  3.0)) * tFrag).rgb * weight[3];
                destColor += texture2D(texture, (fc + vec2(0.0,  4.0)) * tFrag).rgb * weight[4];
            }
            gl_FragColor = vec4(vec3(1.0) - destColor, 1.0);
        }
    `;

  return [blurVertexStr, blurFragmentStr];
}

const MAIN_VERTEX = "main-vertex";
const MAIN_FRAGMENT = "main-fragment";

const mainVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;
    
    uniform mat4 mvpMatrix;
    uniform mat4 invMatrix;
    uniform mat4 mMatrix;
    uniform mat4 tMatrix;
    uniform vec4 ambientColor;
    uniform vec3 eyePosition;
    uniform vec3 lightPosition;
    uniform vec3 tPosition;

    varying vec4 vColor;
    varying vec4 vTexCoord;
    varying float vDotLE;

    void main(void) {
        vec3 pos = (mMatrix * vec4(position, 1.0)).xyz;
        vec3 invLight = normalize(invMatrix * vec4(lightPosition - pos, 1.0)).xyz;
        vec3  invEye   = normalize(invMatrix * vec4(eyePosition, 0.0)).xyz;
        vec3  halfLE   = normalize(invLight + invEye);
        float diffuse = clamp(dot(normal, invLight),0.0, 1.0);
        float specular = pow(clamp(dot(normal, halfLE), 0.0, 1.0), 50.0);
        vColor = color * vec4(vec3(diffuse), 1.0) + vec4(vec3(specular), 0.0) + ambientColor;
        vTexCoord = tMatrix * vec4(pos, 1.0);
        vDotLE = pow(max(dot(normalize(tPosition - eyePosition), normalize(lightPosition)), 0.0), 10.0);
        gl_Position = mvpMatrix * vec4(position, 1.0);
    }

`;
const mainFragmentStr = `
    precision mediump float;

    uniform sampler2D blurTexture;

    varying vec4 vColor;
    varying vec4 vTexCoord;
    varying float vDotLE;
    
    const vec3 throughColor = vec3(1.0, 0.5, 0.2);

    void main(void){
        float bDepth = pow(texture2DProj(blurTexture, vTexCoord).r, 20.0);
        vec3 through = throughColor * vDotLE * bDepth;
        gl_FragColor = vec4(vColor.rgb + through, vColor.a);
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

export default function Scatter() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const matRef = useRef<{ [key: string]: any }>({});
  const glRef = useRef<WebGLRenderingContext>();
  const programInfosRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const frameBufferInfosRef = useRef<{ [key: string]: FrameBufferInfo }>({});
  const geometriesRef = useRef<{ [key: string]: twgl.BufferInfo }>({});
  const weightsRef = useRef<number[]>([]);
  const timeRef = useRef<number>(0);
  const rotationsRef = useRef<number[]>([0, 0, 0]);

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
    rotations[1] += 0.8 * deltaTime;
    rotations[2] += deltaTime;
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { width, height } = cavElem;
    const gl = glRef.current as WebGLRenderingContext;
    const weight = weightsRef.current;
    const { programInfo, depthProgramInfo, diffProgramInfo, blurProgramInfo } =
      programInfosRef.current;
    const { fb1, fb2, fb3, fb4 } = frameBufferInfosRef.current;
    const { torusBufferInfo, sphereBufferInfo, planeBufferInfo } =
      geometriesRef.current;
    const {
      q,
      qt,
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      invMatrix,
      ortMatrix,
      tmpMatrix,
      ort_pMatrix,
      ort_tmpMatrix,
      inv_vMatrix,
      inv_ort_tmpMatrix,
      mMatrixTorus,
      mMatrixSphere,
      tMatrix,
      tvpMatrix,
      tmvpMatrix,
      itmvpMatrix,
      mvpMatrix,
    } = matRef.current;
    const ambientColor = [0.05, 0.05, 0.05, 0.0];
    const target = [0.0, 0.0, 0.0];
    const eyePosition = [0.0, 0.0, 7.0];
    const camUpDirection = [0.0, 1.0, 0.0];
    const invEyePosition = [0.0, 0.0, -7.0];
    q.toVecIII(eyePosition, qt, eyePosition);
    q.toVecIII(camUpDirection, qt, camUpDirection);
    q.toVecIII(invEyePosition, qt, invEyePosition);

    m.lookAt(eyePosition, target, camUpDirection, vMatrix);
    m.perspective(45, width / height, 0.1, 15, pMatrix);
    m.multiply(pMatrix, vMatrix, tmpMatrix);

    m.ortho(-3.0, 3.0, 3.0, -3.0, 0.1, 15, ort_pMatrix);
    m.multiply(ort_pMatrix, vMatrix, ort_tmpMatrix);

    m.lookAt(invEyePosition, target, camUpDirection, inv_vMatrix);
    m.multiply(ort_pMatrix, inv_vMatrix, inv_ort_tmpMatrix);

    tMatrix[0] = 0.5;
    m.multiply(tMatrix, ort_pMatrix, tvpMatrix);
    m.multiply(tvpMatrix, vMatrix, tmvpMatrix);

    tMatrix[0] = -0.5;
    m.multiply(tMatrix, ort_pMatrix, tvpMatrix);
    m.multiply(tvpMatrix, vMatrix, itmvpMatrix);
    let lightPosition = [-1.75, 1.75, 1.75];
    let qLight = q.identity(q.create());
    var qLightPosition = [-1.75, 1.75, 1.75];

    // ライトを回転させる際の軸ベクトル
    var lightAxis = [1.0, 1.0, 0.0];

    // ライト回転軸ベクトルの正規化
    lightAxis = (function (v) {
      var x = v[0] * v[0];
      var y = v[1] * v[1];
      var z = v[2] * v[2];
      var sq = 1 / Math.sqrt(x + y + z);
      return [v[0] * sq, v[1] * sq, v[2] * sq];
    })(lightAxis);

    // クォータニオンを回転
    q.rotate(rotations[1], lightAxis, qLight);
    q.toVecIII(lightPosition, qLight, qLightPosition);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb1.f);

    gl.viewport(0, 0, fb1.width, fb1.height);
    // フレームバッファを初期化
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // プログラムオブジェクトの選択
    gl.useProgram(depthProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, depthProgramInfo, torusBufferInfo);
    m.identity(mMatrixTorus);
    m.rotate(mMatrixTorus, Math.PI * 0.5, [1.0, 0.0, 0.0], mMatrixTorus);
    m.multiply(inv_ort_tmpMatrix, mMatrixTorus, mvpMatrix);
    twgl.setUniforms(depthProgramInfo, {
      mMatrix: mMatrixTorus,
      mvpMatrix,
      eyePosition: invEyePosition,
    });
    twgl.drawBufferInfo(gl, torusBufferInfo);
    twgl.setBuffersAndAttributes(gl, depthProgramInfo, sphereBufferInfo);
    m.identity(mMatrixSphere);
    m.rotate(mMatrixSphere, rotations[1], [0.0, 0.0, 1.0], mMatrixSphere);
    m.translate(mMatrixSphere, [0.0, 1.5, 0.0], mMatrixSphere);
    m.multiply(inv_ort_tmpMatrix, mMatrixSphere, mvpMatrix);
    twgl.setUniforms(depthProgramInfo, {
      mMatrix: mMatrixSphere,
      mvpMatrix,
      eyePosition: invEyePosition,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb2.f);
    gl.viewport(0, 0, fb2.width, fb2.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 绘制正面 算出距离
    gl.useProgram(diffProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, diffProgramInfo, torusBufferInfo);
    m.identity(mMatrixTorus);
    m.rotate(mMatrixTorus, Math.PI * 0.5, [1.0, 0.0, 0.0], mMatrixTorus);
    m.multiply(ort_tmpMatrix, mMatrixTorus, mvpMatrix);
    twgl.setUniforms(diffProgramInfo, {
      mMatrix: mMatrixSphere,
      mvpMatrix,
      eyePosition: eyePosition,
      tMatrix: itmvpMatrix,
      backFaceTexture: fb1.t,
    });
    twgl.drawBufferInfo(gl, torusBufferInfo);
    twgl.setBuffersAndAttributes(gl, diffProgramInfo, sphereBufferInfo);
    m.identity(mMatrixSphere);
    m.rotate(mMatrixSphere, rotations[1], [0.0, 0.0, 1.0], mMatrixSphere);
    m.translate(mMatrixSphere, [0.0, 1.5, 0.0], mMatrixSphere);
    m.multiply(ort_tmpMatrix, mMatrixSphere, mvpMatrix);
    twgl.setUniforms(diffProgramInfo, {
      mMatrix: mMatrixSphere,
      mvpMatrix,
      eyePosition: eyePosition,
      tMatrix: itmvpMatrix,
      backFaceTexture: fb1.t,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    // 根据厚度纹理绘制高斯模糊 横向&纵向
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb3.f);
    gl.viewport(0, 0, fb3.width, fb3.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(blurProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, blurProgramInfo, planeBufferInfo);
    twgl.setUniforms(blurProgramInfo, {
      horizontal: true,
      weight,
      texture: fb2.t,
      ortMatrix,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb4.f);
    gl.viewport(0, 0, fb4.width, fb4.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    twgl.setBuffersAndAttributes(gl, blurProgramInfo, planeBufferInfo);
    twgl.setUniforms(blurProgramInfo, {
      horizontal: false,
      weight,
      texture: fb3.t,
      ortMatrix,
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);

    // 最后绘制到主画面上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, fb4.width, fb4.height);
    gl.clearColor(0.0, 0.1, 0.1, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, torusBufferInfo);
    m.multiply(tmpMatrix, mMatrixTorus, mvpMatrix);
    m.inverse(mMatrixTorus, invMatrix);
    twgl.setUniforms(programInfo, {
      mvpMatrix,
      invMatrix,
      mMatrix: mMatrixTorus,
      tMatrix: tmvpMatrix,
      lightPosition: qLightPosition,
      ambientColor,
      eyePosition,
      tPosition: target,
    });
    twgl.drawBufferInfo(gl, torusBufferInfo);
    twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
    m.multiply(tmpMatrix, mMatrixSphere, mvpMatrix);
    m.inverse(mMatrixSphere, invMatrix);
    twgl.setUniforms(programInfo, {
      mMatrix: mMatrixSphere,
      mvpMatrix,
      invMatrix,
    });
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    gl.flush();

    requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const depthProgramInfo = twgl.createProgramInfo(gl, [
      DEPTH_VERTEX,
      DEPTH_FRAGMENT,
    ]);
    const diffProgramInfo = twgl.createProgramInfo(gl, [
      DIFF_VERTEX,
      DIFF_FRAGMENT,
    ]);
    const blurProgramInfo = twgl.createProgramInfo(
      gl,
      getBlurVertexFragment(gl.canvas.width, gl.canvas.height)
    );

    const programInfo = twgl.createProgramInfo(gl, [
      MAIN_VERTEX,
      MAIN_FRAGMENT,
    ]);
    programInfosRef.current = {
      programInfo,
      depthProgramInfo,
      diffProgramInfo,
      blurProgramInfo,
    };
    const q = new qtnIV();
    const qt = q.identity(q.create());
    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());

    const invMatrix = m.identity(m.create());
    const ortMatrix = m.identity(m.create());
    const tMatrix = m.identity(m.create());
    const ort_pMatrix = m.identity(m.create());
    const ort_tmpMatrix = m.identity(m.create());
    const inv_vMatrix = m.identity(m.create());
    const inv_ort_tmpMatrix = m.identity(m.create());
    const tvpMatrix = m.identity(m.create());
    const tmvpMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const itmvpMatrix = m.identity(m.create());
    const mMatrixTorus = m.identity(m.create());
    const mMatrixSphere = m.identity(m.create());
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

    m.lookAt([0.0, 0.0, 0.5], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
    m.ortho(-1.0, 1.0, 1.0, -1.0, 0.1, 1, pMatrix);
    m.multiply(pMatrix, vMatrix, ortMatrix);

    // gaussianフィルタの重み係数を算出
    var weight = (function (v) {
      var wCoef = new Array(v);
      var t = 0.0;
      var d = 100.0;
      for (var i = 0; i < v; i++) {
        var r = 1.0 + 2.0 * i;
        var w = Math.exp((-0.5 * (r * r)) / d);
        wCoef[i] = w;
        if (i > 0) {
          w *= 2.0;
        }
        t += w;
      }
      for (i = 0; i < v; i++) {
        wCoef[i] /= t;
      }
      return wCoef;
    })(5);
    weightsRef.current = weight;

    matRef.current = {
      q,
      qt,
      m,
      mMatrix,
      vMatrix,
      pMatrix,
      invMatrix,
      ortMatrix,
      tMatrix,
      tmpMatrix,
      ort_pMatrix,
      ort_tmpMatrix,
      inv_vMatrix,
      inv_ort_tmpMatrix,
      mMatrixTorus,
      mMatrixSphere,
      tvpMatrix,
      tmvpMatrix,
      mvpMatrix,
      itmvpMatrix,
    };
    const fBufferWidth = 512;
    const fBufferHeight = 512;
    const fb1 = createFramebuffer(gl, fBufferWidth, fBufferHeight);
    const fb2 = createFramebuffer(gl, fBufferWidth, fBufferHeight);
    const fb3 = createFramebuffer(gl, fBufferWidth, fBufferHeight);
    const fb4 = createFramebuffer(gl, fBufferWidth, fBufferHeight);
    frameBufferInfosRef.current = {
      fb1,
      fb2,
      fb3,
      fb4,
    };
    const torusData = torus(64, 64, 0.25, 0.5, [0.1, 0.1, 0.1, 1.0]);
    const sphereData = sphere(64, 64, 0.5, [1.0, 1.0, 1.0, 1.0]);
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
    geometriesRef.current = {
      torusBufferInfo,
      sphereBufferInfo,
      planeBufferInfo,
    };

    // 深度テストとカリングを有効にする
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas
        ref={cavRef}
        onMouseMove={handleMove}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      <script id={DEPTH_VERTEX} type="notjs">
        {depthVertexStr}
      </script>
      <script id={DEPTH_FRAGMENT} type="notjs">
        {depthFragmentStr}
      </script>
      <script id={DIFF_VERTEX} type="notjs">
        {diffVertexStr}
      </script>
      <script id={DIFF_FRAGMENT} type="notjs">
        {diffFragmentStr}
      </script>
      <script id={MAIN_VERTEX} type="notjs">
        {mainVertexStr}
      </script>
      <script id={MAIN_FRAGMENT} type="notjs">
        {mainFragmentStr}
      </script>
    </Box>
  );
}
