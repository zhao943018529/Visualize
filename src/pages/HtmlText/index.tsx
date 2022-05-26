import React, { useRef, useEffect, useCallback, useState } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

import styles from "./index.module.scss";

const { m4, primitives } = twgl;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec4 position;
    attribute vec3 normal;

    uniform vec3 u_lightWorldPosition;

    uniform mat4 u_viewProjection;
    uniform mat4 u_world;
    uniform mat4 u_worldInverseTranspose;

    varying vec3 v_normal;
    varying vec4 v_position;
    varying vec3 v_surfaceToLight;

    void main() {
        vec4 worldPosition = u_world * position;
        gl_Position =u_viewProjection * worldPosition;
        v_position = position;
        v_normal = mat3(u_worldInverseTranspose) * normal;
        v_surfaceToLight = u_lightWorldPosition - worldPosition.xyz;
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform samplerCube u_texture;

    varying vec3 v_normal;
    varying vec4 v_position;
    varying vec3 v_surfaceToLight;

    void main() {
        vec3 normal = normalize(v_normal);
        vec3 surfaceToLight = normalize(v_surfaceToLight);
        float light = dot(normal, surfaceToLight);
        gl_FragColor = textureCube(u_texture, normalize(v_position.xyz));
        gl_FragColor.rgb *=light;
    }
`;

function generateFace(
  ctx: CanvasRenderingContext2D,
  faceColor: string,
  textColor: string,
  text: string
) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${width * 0.7}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.fillText(text, width / 2, height / 2);
}

export default function HtmlText() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  function loadImages(hrefs: string[]): Promise<HTMLImageElement[]> {
    return Promise.all<any>(
      hrefs.map(
        (href) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = function () {
              resolve(image);
            };
            image.onerror = function (err) {
              reject(err);
            };
            image.src = href;
          })
      )
    );
  }

  //
  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 30);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    // const faceInfos = [
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    //     faceColor: "#F00",
    //     textColor: "#0FF",
    //     text: "+X",
    //   },
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    //     faceColor: "#FF0",
    //     textColor: "#00F",
    //     text: "-X",
    //   },
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    //     faceColor: "#0F0",
    //     textColor: "#F0F",
    //     text: "+Y",
    //   },
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    //     faceColor: "#0FF",
    //     textColor: "#F00",
    //     text: "-Y",
    //   },
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    //     faceColor: "#00F",
    //     textColor: "#FF0",
    //     text: "+Z",
    //   },
    //   {
    //     target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    //     faceColor: "#F0F",
    //     textColor: "#0F0",
    //     text: "-Z",
    //   },
    // ];
    // const ctx = document
    //   .createElement("canvas")
    //   .getContext("2d") as CanvasRenderingContext2D;

    // ctx.canvas.width = 128;
    // ctx.canvas.height = 128;
    // faceInfos.forEach((faceInfo) => {
    //   const { target, faceColor, textColor, text } = faceInfo;
    //   generateFace(ctx, faceColor, textColor, text);

    //   // Upload the canvas to the cubemap face.
    //   const level = 0;
    //   const internalFormat = gl.RGBA;
    //   const format = gl.RGBA;
    //   const type = gl.UNSIGNED_BYTE;
    //   gl.texImage2D(target, level, internalFormat, format, type, ctx.canvas);
    // });
    // gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    // gl.texParameteri(
    //   gl.TEXTURE_CUBE_MAP,
    //   gl.TEXTURE_MIN_FILTER,
    //   gl.LINEAR_MIPMAP_LINEAR
    // );
    const faceInfos = [
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: "/front.JPG" },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: "/back.JPG" },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: "/up.JPG" },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: "/down.JPG" },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: "/left.JPG" },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: "/right.JPG" },
    ];
    loadImages(faceInfos.map((info) => info.url)).then((vals) => {
      vals.forEach((image, index) => {
        const faceInfo = faceInfos[index];
        const level = 0;
        const internalFormat = gl.RGBA;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        gl.texImage2D(
          faceInfo.target,
          level,
          internalFormat,
          format,
          type,
          image
        );
      });
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      gl.texParameteri(
        gl.TEXTURE_CUBE_MAP,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );
    });
    const cameraPosition = [100, 0, 0];
    const up = [0, 1, 0];
    const target = [0, 0, 0];
    const fieldOfViewYInRadians = deg2radians(60);
    const aspect = cavElem.width / cavElem.height;
    const projectionMatrix = m4.perspective(
      fieldOfViewYInRadians,
      aspect,
      0.1,
      1000
    );
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);
    let xAngleRadians = 0;
    let yAngleRadians = 0;
    let then = 0;
    let rotationSpeed = 0.8;
    const pointVec = [15, 15, 15];
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    function drawScene(time: number) {
      time *= 0.001;
      const deltaTime = time - then;
      then = time;
      xAngleRadians += deltaTime * rotationSpeed;
      yAngleRadians += deltaTime;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      // Clear the canvas AND the depth buffer.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);

      let matrix = m4.rotationX(xAngleRadians);
      matrix = m4.rotateY(matrix, yAngleRadians);
      const worldInverseMatrix = m4.inverse(matrix);
      const worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);
      const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
      const worldViewMatrix = m4.multiply(viewProjectionMatrix, matrix);
      const convertPoint = m4.transformPoint(worldViewMatrix, pointVec);
      const x = (convertPoint[0] * 0.5 + 0.5) * canvasWidth;
      const y = (convertPoint[0] * -0.5 + 0.5) * canvasHeight;
      const textNode = textRef.current as HTMLDivElement;
      textNode.textContent = `${xAngleRadians} ~ ${yAngleRadians}`;
      textNode.style.left = `${x}px`;
      textNode.style.top = `${y}px`;
      gl.useProgram(programInfo.program);
      twgl.setUniforms(programInfo, {
        u_viewProjection: viewProjectionMatrix,
        u_world: matrix,
        u_worldInverseTranspose: worldInverseTransposeMatrix,
        u_color: [0.2, 0.5, 0.3, 1],
        u_texture: texture,
        u_lightWorldPosition: [0, 50, -80],
      });
      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
      twgl.drawBufferInfo(gl, cubeBufferInfo, gl.TRIANGLES);

      requestAnimationFrame(drawScene);
    }

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={cavRef} width={1000} height={800} />
      <div ref={textRef} className={styles.content}></div>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
    </div>
  );
}
