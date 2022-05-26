import React, { useRef, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import styles from "./index.module.scss";
import { deg2radians } from "../../utils/math";

console.log(styles);

const { m4, primitives } = twgl;

const VERTEX_ID = "vertex_id";
const FRAGMENT_ID = "fragment_id";

const vertexStr = `
    attribute vec4 position;
    attribute vec3 normal;

    uniform mat4 u_matrix;
    uniform mat4 u_world;

    varying vec3 v_color;

    void main() {
        gl_Position = u_matrix * u_world * position;
        v_color = normal * 0.5 + 0.5;
    }
`;

const fragmentStr = `
    precision mediump float;

    varying vec3 v_color;

    void main() {
        gl_FragColor= vec4(v_color, 1);
    }
`;

function createView(parent: HTMLElement, text: string) {
  const elem = document.createElement("div");
  elem.className = styles["view-item"];
  const itemContent = document.createElement("div");
  itemContent.className = styles["view-item-content"];
  const itemLabel = document.createElement("div");
  itemLabel.className = styles["view-item-label"];
  itemLabel.textContent = text;
  elem.appendChild(itemContent);
  elem.appendChild(itemLabel);
  parent.appendChild(elem);

  return elem;
}

function random(max: number, min: number = 0) {
  return Math.random() * (max - min) + min;
}

function getGeometry(geometries: twgl.BufferInfo[], index: number) {
  return geometries[index % geometries.length];
}

export default function MultiView() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const elemRef = useRef<HTMLDivElement>(null);

  const drawScene = useCallback(
    (
      gl: WebGLRenderingContext,
      programInfo: twgl.ProgramInfo,
      projectionMatrix: twgl.m4.Mat4,
      cameraMatrix: twgl.m4.Mat4,
      worldMatrix: twgl.m4.Mat4,
      bufferInfo: twgl.BufferInfo
    ) => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const viewMatrix = m4.inverse(cameraMatrix);
      const matrix = m4.multiply(projectionMatrix, viewMatrix);
      gl.useProgram(programInfo.program);
      twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
      twgl.setUniforms(programInfo, {
        u_matrix: matrix,
        u_world: worldMatrix,
      });
      twgl.drawBufferInfo(gl, bufferInfo);
    },
    []
  );

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const cylinderBufferInfo = primitives.createCylinderBufferInfo(
      gl,
      0.8,
      0.8,
      10,
      10
    );
    const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 0.5, 10, 10);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 1);
    const geometries = [cylinderBufferInfo, sphereBufferInfo, cubeBufferInfo];
    const container = elemRef.current as HTMLDivElement;
    const numElements = 100;
    let objectsToDraw: any[] = [];
    for (let i = 0; i < numElements; i++) {
      const element = createView(container, `Item-${i + 1}`);
      const bufferInfo = getGeometry(geometries, i);
      const color = [random(1), random(1), random(1), 1];
      objectsToDraw.push({
        color,
        element,
        bufferInfo,
      });
    }

    function render(time: number) {
      time *= 0.001;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.SCISSOR_TEST);
      gl.canvas.style.transform = `translateX(${window.scrollX}px) translateY(${window.scrollY}px)`;

      for (const { bufferInfo, element, color } of objectsToDraw) {
        const rect = element.getBoundingClientRect();
        if (
          rect.bottom < 0 ||
          rect.top > cavElem.clientHeight ||
          rect.right < 0 ||
          rect.left > cavElem.clientWidth
        ) {
          continue;
        }
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;
        const left = rect.left;
        const bottom = cavElem.clientHeight - rect.bottom;
        gl.viewport(left, bottom, width, height);
        gl.scissor(left, bottom, width, height);
        gl.clearColor(color[0], color[1], color[2], color[3]);
        const aspect = width / height;
        const near = 1;
        const far = 2000;
        const perspectiveProjectionMatrix = m4.perspective(
          deg2radians(60),
          aspect,
          near,
          far
        );
        const cameraPos = [0, 0, -2];
        const target = [0, 0, 0];
        const up = [0, 1, 0];
        const cameraMatrix = m4.lookAt(cameraPos, target, up);
        // const rTime = time * 0.1;
        const worldMatrix = m4.rotateX(m4.rotationY(time), time);
        drawScene(
          gl,
          programInfo,
          perspectiveProjectionMatrix,
          cameraMatrix,
          worldMatrix,
          bufferInfo
        );
      }

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }, []);

  return (
    <div>
      <canvas
        ref={cavRef}
        style={{
          width: "100%",
          position: "absolute",
          top: 0,
          height: "100%",
          zIndex: -1,
        }}
      />
      <div ref={elemRef} className={styles.viewContainer}></div>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
    </div>
  );
}
