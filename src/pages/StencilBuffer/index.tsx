import React, { useRef, useState, useCallback, useEffect } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { matIV, qtnIV, torus, sphere, cube } from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 960;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";
const vertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 texCoord;
    attribute vec4 color;

    uniform mat4 invMatrix;
    uniform mat4 mvpMatrix;
    uniform vec3 lightDirection;
    uniform bool useLight;
    uniform bool outline;

    varying vec4 vColor;
    varying vec2 vTexCoord;

    void main() {
        if(useLight){
            vec3 invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
            float diffuse = clamp(dot(normal, invLight), 0.0, 1.0);
            vColor = color * vec4(vec3(diffuse), 1.0);
        }else{
            vColor = color;
        }
        vec3 oPosition = position;
        if(outline){
            oPosition += normal * 0.1;
        }
        vTexCoord = texCoord;

        gl_Position = mvpMatrix * vec4(oPosition, 1.0);
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform bool useTexture;

    varying vec2 vTexCoord;
    varying vec4 vColor;

    void main() {
        vec4 smpColor =vec4(1.0);
        if(useTexture){
            smpColor = texture2D(u_texture, vTexCoord);
        }

        gl_FragColor = vColor * smpColor;
    }
`;

export default function StencilBufer() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const qmatRef = useRef<{ [key: string]: any }>({});

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

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem, { stencil: true });
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);

    const torusData = torus(64, 64, 0.25, 1.0);
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
    const sphereData = sphere(64, 64, 1.0, [1.0, 1.0, 1.0, 1.0]);
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
      texCoord: {
        data: sphereData.t,
        numComponents: 2,
      },
    });
    const uTexture = twgl.createTexture(gl, {
      src: "texture.png",
    //   mag: gl.NEAREST,
    });
    const q = new qtnIV();
    const qt = q.identity(q.create());
    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());
    const qMatrix = m.identity(m.create());

    qmatRef.current = {
      q,
      qt,
    };

    const lightDirection = [1.0, 1.0, 1.0];

    let prev = 0;
    let rotations = [0, 0];

    gl.useProgram(programInfo.program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    let count = 0;

    function render(time: number) {
      time *= 0.001;
      const deltaTime = time - prev;
      rotations[0] += 1.2 * deltaTime;
      rotations[1] += deltaTime;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(
        gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT
      );

      const { width, height } = gl.canvas;
      count++;
      const rad = ((count % 360) * Math.PI) / 180;

      m.lookAt([0.0, 0.0, 10.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
      m.perspective(45, width / height, 0.1, 100, pMatrix);

      q.toMatIV(qt, qMatrix);
      m.multiply(vMatrix, qMatrix, vMatrix);
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      gl.enable(gl.STENCIL_TEST);

      gl.colorMask(false, false, false, false);
      gl.depthMask(false);

      gl.stencilFunc(gl.ALWAYS, 1, ~0);
      gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);

      twgl.setBuffersAndAttributes(gl, programInfo, torusBufferInfo);

      m.identity(mMatrix);
      m.rotate(mMatrix, rad, [0.0, 1.0, 1.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);
      m.inverse(mMatrix, invMatrix);
      twgl.setUniforms(programInfo, {
        useTexture: false,
        mvpMatrix,
        useLight: false,
        invMatrix,
        outline: true,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);

      gl.colorMask(true, true, true, true);
      gl.depthMask(true);

      gl.stencilFunc(gl.EQUAL, 0, ~0);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

      twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
      m.identity(mMatrix);
      m.scale(mMatrix, [50.0, 50.0, 50.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);
      m.inverse(mMatrix, invMatrix);
      twgl.setUniforms(programInfo, {
        useLight: false,
        useTexture: true,
        u_texture: uTexture,
        invMatrix,
        mvpMatrix,
      });

      twgl.drawBufferInfo(gl, sphereBufferInfo);

      gl.disable(gl.STENCIL_TEST);

      twgl.setBuffersAndAttributes(gl, programInfo, torusBufferInfo);
      m.identity(mMatrix);
      m.rotate(mMatrix, rad, [0.0, 1.0, 1.0], mMatrix);
      m.multiply(tmpMatrix, mMatrix, mvpMatrix);

      m.inverse(mMatrix, invMatrix);
      twgl.setUniforms(programInfo, {
        useLight: true,
        lightDirection,
        outline: false,
        useTexture: false,
        invMatrix,
        mvpMatrix,
      });
      twgl.drawBufferInfo(gl, torusBufferInfo);

      gl.flush();

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }, []);

  return (
    <div>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMove}
      />
      <script id={VERTEX_ID}>{vertexStr}</script>
      <script id={FRAGMENT_ID}>{fragmentStr}</script>
    </div>
  );
}
