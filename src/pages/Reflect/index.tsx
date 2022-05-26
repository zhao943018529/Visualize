import React, { useEffect, useState, useCallback, useRef } from "react";
import * as twgl from "twgl.js";
import { Box } from "@mui/material";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const VERTEX_SHADER_ID = "vertex-shader";
const FRAME_SHADER_ID = "frame-shader";

const vertexShaderStr = `
    attribute vec4 position;
    attribute vec3 normal;

    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;

    varying vec3 v_normal;
    varying vec3 v_worldPosition;

    void main() {
        vec4 worldPosition = u_world * position;

        v_normal = mat3(u_world) * normal;
        v_worldPosition = worldPosition.xyz;
        gl_Position = u_projection * u_view * worldPosition;
    }
`;

const frameShaderStr = `
    precision mediump float;

    uniform samplerCube u_textureCube;
    uniform vec3 eyePosition;

    varying vec3 v_worldPosition;
    varying vec3 v_normal;

    void main() {
        vec3 normal = normalize(v_normal);
        vec3 eyeToSurface = normalize(v_worldPosition - eyePosition);
        vec3 direction = reflect(eyeToSurface, normal);

        gl_FragColor = textureCube(u_textureCube, direction);
    }
`;

export default function Reflect() {
  const cavRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [
      vertexShaderStr,
      frameShaderStr,
    ]);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 1);

    const cameraPos = [1, 2, 1];
    const up = [0, 1, 0];
    const target = [0, 0, 0];

    const cameraMatrix = m4.lookAt(cameraPos, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);
    const aspect = gl.canvas.width / gl.canvas.height;
    const projectionMatrix = m4.perspective(deg2radians(60), aspect, 0.5, 1000);

    const cubeTexture = twgl.createTexture(gl, {
      target: gl.TEXTURE_CUBE_MAP,
      src: [
        "/pos-x.jpg",
        "/neg-x.jpg",
        "/pos-y.jpg",
        "/neg-y.jpg",
        "/pos-z.jpg",
        "/neg-z.jpg",
      ],
    });

    const commonUnifoms: Record<string, any> = {
      u_projection: projectionMatrix,
      u_view: viewMatrix,
      eyePosition: cameraPos,
      u_textureCube: cubeTexture,
    };

    let xAngleRadians = deg2radians(0);
    let yAngleRadians = deg2radians(0);
    let then = 0;
    function render(time: number) {
      time *= 0.001;
      const deltaTime = time - then;
      then = time;
      yAngleRadians += -0.7 * deltaTime;
      xAngleRadians += -0.4 * deltaTime;

      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(programInfo.program);
      let worldMatrix = m4.multiply(
        m4.rotationX(xAngleRadians),
        m4.rotationY(yAngleRadians)
      );
      commonUnifoms.u_world = worldMatrix;

      twgl.setUniforms(programInfo, commonUnifoms);
      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);

      gl.drawElements(
        gl.TRIANGLES,
        cubeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas ref={cavRef} width={1200} height={800} />
      <script src={VERTEX_SHADER_ID} type="notjs">
        {vertexShaderStr}
      </script>
      <script src={FRAME_SHADER_ID} type="notjs">
        {frameShaderStr}
      </script>
    </Box>
  );
}
