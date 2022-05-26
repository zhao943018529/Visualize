import React, { useRef, useEffect, useCallback, useState } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
  attribute vec3 position;
  attribute vec4 color;
  attribute vec2 textureCoord;
  
  uniform mat4 u_matrix;
  
  varying  vec4 vColor;
  varying vec2 vTextureCoord;

  void main() {
      vColor = color;
      vTextureCoord = textureCoord;
      gl_Position = u_matrix * vec4(position, 1.0);
  }

`;

const fragmentStr = `
    precision mediump float;

    uniform sampler2D texture;
    varying vec4 vColor;
    varying vec2 vTextureCoord;

    void main() {
        vec4 smpColor = texture2D(texture, vTextureCoord);
        gl_FragColor = vColor * smpColor;
    }
`;

export default function Billboard() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const texturesRef = useRef<{ [key: string]: WebGLTexture }>({});
  const programInfoRef = useRef<twgl.ProgramInfo>();
  const bufferInfosRef = useRef<{ [key: string]: twgl.BufferInfo }>({});

  const [xyr, setXYR] = useState<number[]>([0, 0, 0]);

  const handleMove = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { width, height } = cavElem;
    const wh = 1 / Math.sqrt(width * width + height * height);
    let x = evt.clientX - cavElem.offsetLeft - width * 0.5;
    let y = evt.clientY - cavElem.offsetTop - height * 0.5;

    const sq = Math.sqrt(x * x + y * y);
    const r = sq * 2.0 * Math.PI * wh;
    if (sq != 1) {
      x *= 1 / sq;
      y *= 1 / sq;
    }
    setXYR([y, x, r]);
  }, []);

  const render = useCallback((vals: number[]) => {
    const gl = glRef.current as WebGLRenderingContext;
    const programInfo = programInfoRef.current as twgl.ProgramInfo;
    const { texture0, texture1 } = texturesRef.current;
    const { rectangle } = bufferInfosRef.current;

    const [x, y, r] = vals;
    const { width, height } = gl.canvas;
    const aspect = width / height;
    const fieldOfViewYInRadians = deg2radians(45);

    const qMatrix = m4.axisRotation([x, y, 0.0], r);
    const projectionMatrix = m4.perspective(
      fieldOfViewYInRadians,
      aspect,
      0.1,
      100
    );
    const cameraPosition = [0.0, 5.0, 10.0];
    const target = [0.0, 0.0, 0.0];
    const up = [0.0, 1.0, 0.0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    let viewMatrix = m4.inverse(cameraMatrix);
    viewMatrix = m4.multiply(viewMatrix, qMatrix);

    let worldMatrix = m4.axisRotation([1, 0, 0], deg2radians(Math.PI / 2));
    // let worldMatrix = m4.rotationX(deg2radians(Math.PI / 2));
    worldMatrix = m4.scale(worldMatrix, [3.0, 3.0, 1.0]);
    const vpMatrix = m4.multiply(projectionMatrix, viewMatrix);
    const mvpMatrix = m4.multiply(vpMatrix, worldMatrix);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, rectangle);
    twgl.setUniforms(programInfo, {
      u_matrix: mvpMatrix,
      texture: texture1,
    });
    twgl.drawBufferInfo(gl, rectangle);

    const camera2Matrix = m4.lookAt(target, cameraPosition, up);
    let invMatrix = m4.inverse(camera2Matrix);
    invMatrix = m4.multiply(invMatrix, qMatrix);
    invMatrix = m4.inverse(invMatrix);
    invMatrix = m4.inverse(qMatrix);

    let world2Matrix = m4.multiply(m4.translation([0.0, 0.0, -1.0]), invMatrix);
    const mvp2Matrix = m4.multiply(vpMatrix, world2Matrix);

    twgl.setBuffersAndAttributes(gl, programInfo, rectangle);
    twgl.setUniforms(programInfo, {
      u_matrix: mvp2Matrix,
      texture: texture0,
    });
    twgl.drawBufferInfo(gl, rectangle);

    gl.flush();
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    programInfoRef.current = programInfo;
    texturesRef.current = twgl.createTextures(gl, {
      texture0: {
        src: "/texture0.png",
        mag: gl.NEAREST,
      },
      texture1: {
        src: "/texture1.png",
        mag: gl.NEAREST,
      },
    });
    const position = [
      -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0,
    ];
    const color = [
      1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0,
    ];
    const textureCoord = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0];
    const index = [0, 1, 2, 3, 2, 1];

    bufferInfosRef.current.rectangle = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 3,
      },
      color: {
        data: color,
        numComponents: 4,
      },
      indices: {
        data: index,
        numComponents: 3,
      },
      textureCoord: {
        data: textureCoord,
        numComponents: 2,
      },
    });
    // 各種フラグを有効化する
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);

    // ブレンドファクター
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
  }, []);

  useEffect(() => {
    render(xyr);
  }, [xyr]);

  return (
    <div>
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
    </div>
  );
}
