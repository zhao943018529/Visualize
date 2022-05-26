import React, { useRef, useCallback, useState, useEffect } from "react";
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

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;
    attribute vec4 color;

    varying vec4 vColor;

    void main() {
        vColor = color;

        gl_Position = vec4(position, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    varying vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

export default function EdgeLine() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const [mouseInfo, setMouseInfo] = useState<number[]>([0, 0]);
  const [colorInfo, setColorInfo] = useState<number[]>([0, 0, 0]);
  const glInfoRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [
      DEFAULT_VERTEX_ID,
      DEFAULT_FRAGMENT_ID,
    ]);
    const colors = [
      1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0,
    ];
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
      color: {
        data: colors,
        numComponents: 4,
      },
    });
    glInfoRef.current = {
      gl,
      programInfo,
      planeBufferInfo,
    };
  }, []);

  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { offsetLeft, offsetTop } = cavElem;
    const mouseX = evt.clientX - offsetLeft;
    const mouseY = cavElem.height - (evt.clientY - offsetTop);

    setMouseInfo([mouseX, mouseY]);
  };

  const render = useCallback((mouseX: number, mouseY: number) => {
    const { gl, programInfo, planeBufferInfo } = glInfoRef.current;
    gl.useProgram(programInfo.program);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
    twgl.drawBufferInfo(gl, planeBufferInfo);
    gl.flush();
    const u8 = new Uint8Array(4);
    gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, u8);
    setColorInfo([u8[0], u8[1], u8[2], u8[3]]);
  }, []);

  useEffect(() => {
    render(mouseInfo[0], mouseInfo[1]);
  }, [mouseInfo]);

  return (
    <div>
      <div>RGBA({colorInfo.join(", ")})</div>
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
