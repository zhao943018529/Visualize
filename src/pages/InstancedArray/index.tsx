import React, { useEffect, useRef } from "react";
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

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 960;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec3 instancePosition;
    attribute vec4 instanceColor;

    uniform mat4 mvpMatrix;
    uniform mat4 invMatrix;
    uniform vec3 lightDirection;
    uniform vec3 eyeDirection;

    varying vec4 vColor;

    void main() {
        vec3 invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
        vec3 invEye = normalize(invMatrix * vec4(eyeDirection, 0.0)).xyz;
        vec3 halfLE = normalize(invLight + invEye);
        float diffuse = clamp(dot(normal, invLight), 0.1, 1.0);
        float specular = pow(clamp(dot(normal, halfLE), 0.0, 1.0), 30.0);
        vColor = instanceColor * vec4(vec3(diffuse), 1.0) + vec4(vec3(specular), 1.0);

        gl_Position = mvpMatrix * vec4(position + instancePosition, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    varying vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

function createFrameBuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  format?: number
) {
  const textureFormat = format || gl.UNSIGNED_BYTE;
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
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
    textureFormat,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
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

  return {
    fTexture,
    fb,
    width,
    height,
  };
}

export default function InstancedArray() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const mouseInfo = useRef({
    mouse: [0.0, 0.0],
    run: true,
    mouseFlag: false,
  });

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const ext = gl.getExtension("ANGLE_instanced_arrays");
    if (ext == null) {
      console.log("ANGLE_instanced_arrays not supported");
      return;
    }
    const defaultProgramInfo = twgl.createProgramInfo(gl, [
      DEFAULT_VERTEX_ID,
      DEFAULT_FRAGMENT_ID,
    ]);

    // 初始化planeBufferInfo
    const position = [
      -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0,
    ];
    // const indices = [0, 1, 2, 1, 3, 2];
    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 3,
      },
      //   indices: {
      //     data: indices,
      //     numComponents: 3,
      //   },
    });
    const torusData = torus(32, 32, 0.08, 0.15);
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
    const instancePositions = [];
    const instanceColors = [];
    const instanceCount = 100;
    const offsetPosition = 3;
    const offsetColor = 4;

    for (let i = 0; i < instanceCount; i++) {
      let j = i % 10;
      const k = Math.floor(i / 10) * 0.5 + 0.5;
      const rad = ((3600 / instanceCount) * j * Math.PI) / 180;
      instancePositions[i * offsetPosition] = Math.cos(rad) * k;
      instancePositions[i * offsetPosition + 1] = 0.0;
      instancePositions[i * offsetPosition + 2] = Math.sin(rad) * k;
      const hsv = hsva((3600 / instanceCount) * i, 1.0, 1.0, 1.0) as number[];
      instanceColors[i * offsetColor] = hsv[0];
      instanceColors[i * offsetColor + 1] = hsv[1];
      instanceColors[i * offsetColor + 2] = hsv[2];
      instanceColors[i * offsetColor + 3] = hsv[3];
    }

    const instancesBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      instancePosition: {
        data: instancePositions,
        numComponents: 3,
      },
      instanceColor: {
        data: instanceColors,
        numComponents: 4,
      },
    });

    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());
    const q = new qtnIV();
    const qt = q.identity(m.create());

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    gl.useProgram(defaultProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, defaultProgramInfo, torusBufferInfo);
    twgl.setBuffersAndAttributes(gl, defaultProgramInfo, instancesBufferInfo);
    const instanceAttrib = gl.getAttribLocation(
      defaultProgramInfo.program,
      "instancePosition"
    );
    ext.vertexAttribDivisorANGLE(instanceAttrib, 1);
    const instanceColorAttrib = gl.getAttribLocation(
      defaultProgramInfo.program,
      "instanceColor"
    );
    ext.vertexAttribDivisorANGLE(instanceColorAttrib, 1);
    const lightDirection = [-0.577, 0.577, 0.577];
    let count = 0;
    function render(time: number) {
      const rad = ((++count % 360) * Math.PI) / 180;

      const aspect = gl.canvas.width / gl.canvas.height;
      const eyePosition = [0.0, 0.0, 15.0];
      const camUpDirection = [0.0, 1.0, 0.0];
      q.toVecIII(eyePosition, qt, eyePosition);
      q.toVecIII(camUpDirection, qt, camUpDirection);
      m.lookAt(eyePosition, [0.0, 0.0, 0.0], camUpDirection, vMatrix);
      m.perspective(90, aspect, 0.1, 50.0, pMatrix);
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      gl.clearColor(0.75, 0.75, 0.75, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      m.identity(mMatrix);
      m.rotate(mMatrix, rad, [1.0, 1.0, 0.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);
      m.inverse(mMatrix, invMatrix);
      twgl.setUniforms(defaultProgramInfo, {
        lightDirection,
        eyeDirection: eyePosition,
        mvpMatrix,
        invMatrix,
      });
      ext?.drawElementsInstancedANGLE(
        gl.TRIANGLES,
        torusData.i.length,
        gl.UNSIGNED_SHORT,
        0,
        instanceCount
      );
      gl.flush();

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const cw = cavElem.width;
    const ch = cavElem.height;
    mouseInfo.current.mouse = [
      ((evt.clientX - cavElem.offsetLeft - cw / 2.0) / cw) * 2.0,
      (-(evt.clientY - cavElem.offsetTop - ch / 2.0) / ch) * 2.0,
    ];
  };

  return (
    <div>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
      />
      <script type="notjs" id={DEFAULT_VERTEX_ID}>
        {defaultVertexStr}
      </script>
      <script type="notjs" id={DEFAULT_FRAGMENT_ID}>
        {defaultFragmentStr}
      </script>
    </div>
  );
}
