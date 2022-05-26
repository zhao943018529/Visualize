import React, { useRef, useState, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;
/**
 * 原理：
 *
 * @returns
 */

const VERTEX_ID = "vertex-shader";
const FRAGMENT_ID = "fragment-shader";

const vertexShaderStr = `
    attribute vec4 position;
    attribute vec2 texcoord;

    uniform mat4 u_Matrix;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = u_Matrix * position;
        v_texCoord = texcoord;
    }
`;

const fragmentShaderStr = `
    precision mediump float;

    uniform sampler2D u_texture;

    varying vec2 v_texCoord;

    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
`;

const targetTextureWidth = 256;
const targetTextureHeight = 256;

export default function Frame() {
  const cavRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programInfoRef = useRef<twgl.ProgramInfo | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const framebufferRef = useRef<twgl.FramebufferInfo | null>(null);
  const targetTextureRef = useRef<WebGLTexture | null>(null);
  const timeRef = useRef<number>(0);
  const rotationRadiansRef = useRef<{
    modelYRotationRadians: number;
    modelXRotationRadians: number;
  }>({
    modelXRotationRadians: deg2radians(0),
    modelYRotationRadians: deg2radians(0),
  });

  const drawCube = useCallback((aspect: number, texture: WebGLTexture) => {
    const programInfo = programInfoRef.current as twgl.ProgramInfo;
    const gl = glRef.current as WebGLRenderingContext;
    gl.useProgram(programInfo.program);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 1);
    const projectionMatrix = m4.perspective(deg2radians(60), aspect, 1, 2000);
    const cameraPos = [0, 0, 2];
    const up = [0, 1, 0];
    const target = [0, 0, 0];
    const cameraMatrix = m4.lookAt(cameraPos, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);

    const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
    let { modelXRotationRadians, modelYRotationRadians } =
      rotationRadiansRef.current;
    for (let i = -1; i <= 1; ++i) {
      let matrix = m4.translate(viewProjectionMatrix, [i * 0.9, 0, 0]);
      matrix = m4.rotateX(matrix, modelXRotationRadians);
      matrix = m4.rotateY(matrix, modelYRotationRadians * i);
      const uniforms = {
        u_Matrix: matrix,
        u_texture: texture,
      };

      twgl.setUniforms(programInfo, uniforms);
      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
      gl.drawElements(
        gl.TRIANGLES,
        cubeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
    }
  }, []);

  const render = useCallback((time: number) => {
    time *= 0.001;
    const deltaTime = time - timeRef.current;
    timeRef.current = time;
    let { modelXRotationRadians, modelYRotationRadians } =
      rotationRadiansRef.current;
    modelYRotationRadians += -0.7 * deltaTime;
    modelXRotationRadians += -0.4 * deltaTime;
    rotationRadiansRef.current = {
      modelYRotationRadians,
      modelXRotationRadians,
    };
    const frameBufferInfo = framebufferRef.current as twgl.FramebufferInfo;
    const gl = glRef.current as WebGLRenderingContext;
    const programInfo = programInfoRef.current;
    const targetTexture = targetTextureRef.current as WebGLTexture;
    const texture = textureRef.current as WebGLTexture;
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // 先渲染texture到framebuffer,然后将framebuffer渲染到画板
    let aspect: number;
    aspect = targetTextureWidth / targetTextureHeight;
    twgl.bindFramebufferInfo(gl, frameBufferInfo);
    // const status = gl.checkFramebufferStatus();
    // gl.bindFramebuffer(
    //   gl.FRAMEBUFFER,
    //   framebufferRef.current as WebGLFramebuffer
    // );
    // // gl.bindTexture(gl.TEXTURE_2D, texture);
    // gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawCube(aspect, texture);

    twgl.bindFramebufferInfo(gl, null);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // // gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    aspect = gl.canvas.width / gl.canvas.height;
    drawCube(aspect, targetTexture);

    requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    // 初始化数据
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    programInfoRef.current = programInfo;

    // const texture = gl.createTexture();
    const { texture, targetTexture } = twgl.createTextures(gl, {
      texture: {
        mag: gl.NEAREST,
        min: gl.LINEAR,
        format: gl.LUMINANCE,
        src: new Uint8Array([128, 64, 128, 0, 192, 0]),
      },
      targetTexture: {
        min: gl.NEAREST,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        width: targetTextureWidth,
        height: targetTextureHeight,
      },
    });
    textureRef.current = texture;
    // gl.bindTexture(gl.TEXTURE_2D, texture);
    // const levelA = 0;
    // const internalFormatA = gl.LUMINANCE;
    // const widthA = 3;
    // const heightA = 2;
    // const borderA = 0;
    // const formatA = gl.LUMINANCE;
    // const typeA = gl.UNSIGNED_BYTE;
    // const dataA = new Uint8Array([128, 64, 128, 0, 192, 0]);
    // const alignmentA = 1;
    // gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignmentA);
    // gl.texImage2D(
    //   gl.TEXTURE_2D,
    //   levelA,
    //   internalFormatA,
    //   widthA,
    //   heightA,
    //   borderA,
    //   formatA,
    //   typeA,
    //   dataA
    // );
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    targetTextureRef.current = targetTexture;
    // const targetTexture = gl.createTexture();
    // gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    // gl.texImage2D(
    //   gl.TEXTURE_2D,
    //   0,
    //   gl.RGBA,
    //   targetTextureWidth,
    //   targetTextureHeight,
    //   0,
    //   gl.RGBA,
    //   gl.UNSIGNED_BYTE,
    //   null
    // );
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const frameBufferInfo = twgl.createFramebufferInfo(
      gl,
      [
        {
          attachment: targetTexture,
          attachmentPoint: gl.COLOR_ATTACHMENT0,
          target: gl.TEXTURE_2D,
          level: 0,
          format: gl.DEPTH_COMPONENT16,
        },
      ],
      targetTextureWidth,
      targetTextureHeight
    );
    framebufferRef.current = frameBufferInfo;
    // const fb = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    // const attachmentPoint = gl.COLOR_ATTACHMENT0;
    // const level = 0;
    // gl.framebufferTexture2D(
    //   gl.FRAMEBUFFER,
    //   attachmentPoint,
    //   gl.TEXTURE_2D,
    //   targetTexture,
    //   level
    // );
    requestAnimationFrame(render);
  }, []);

  return (
    <Box>
      <canvas ref={cavRef} width={1000} height={800}></canvas>
      <script id={VERTEX_ID} type="notjs">
        {vertexShaderStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentShaderStr}
      </script>
    </Box>
  );
}
