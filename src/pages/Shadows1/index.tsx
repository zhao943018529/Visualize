import React, { useEffect, useRef, useState, useCallback } from "react";
import * as twgl from "twgl.js";
import { Box, Slider } from "@mui/material";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const VERTEX_ID = "vertex-glsl";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec4 position;
    attribute vec2 texcoord;

    uniform mat4 u_view;
    uniform mat4 u_world;
    uniform mat4 u_textureMatrix;
    uniform mat4 u_projection;

    varying vec4 v_textureProjection;
    varying vec2 v_texcoord;

    void main() {
        vec4 worldPostion = u_world * position;
        gl_Position = u_projection * u_view * worldPostion;
        v_texcoord = texcoord;
        v_textureProjection = u_textureMatrix * worldPostion;
    }
`;

const fragmentStr = `
    precision mediump float;

    varying vec2 v_texcoord;
    varying vec4 v_textureProjection;

    uniform vec4 u_colorMult;
    uniform sampler2D u_projectedTexture;
    uniform sampler2D u_texture;


    void main() {
        vec3 textureProjection = v_textureProjection.xyz / v_textureProjection.w;

        bool inRange = textureProjection.x >= 0.0 && textureProjection.x <= 1.0
                        && textureProjection.y >= 0.0 && textureProjection.y <= 1.0;
        vec4 projectedColor = texture2D(u_projectedTexture, textureProjection.xy);
        vec4 texColor = texture2D(u_texture, v_texcoord) * u_colorMult;
        float projectedAmount = inRange ? 1.0 : 0.0;
        gl_FragColor = mix(texColor, projectedColor, projectedAmount);
    }
`;
const COLOR_VERTEX_ID = "color-vertex-glsl";
const COLOR_FRAGMENT_ID = "color-fragment-id";

const colorVertexStr = `
    attribute vec4 position;
    
    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;

    void main() {
        gl_Position = u_projection * u_view * u_world * position;
    }
`;

const colorFragmentStr = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }
`;

interface ISettingInfo {
  projWidth: number;
  projHeight: number;
  position: number[];
  target: number[];
  eyePosition: number[];
}

export default function Shadows() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const textureRef = useRef<{ [key: string]: WebGLTexture }>({});
  const programInfosRef = useRef<Record<string, twgl.ProgramInfo>>({});
  const [setting, setSetting] = useState<ISettingInfo>({
    projWidth: 1,
    projHeight: 1,
    position: [2.5, 4.8, 4.3],
    target: [2.5, 0, 3.5],
    eyePosition: [-3.75, 7, 10],
  });

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getContext(cavElem);
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const colorProgramInfo = twgl.createProgramInfo(gl, [
      COLOR_VERTEX_ID,
      COLOR_FRAGMENT_ID,
    ]);
    programInfosRef.current = {
      programInfo,
      colorProgramInfo,
    };
    textureRef.current = twgl.createTextures(gl, {
      hftIcon: { src: "/f-texture.png", mag: gl.NEAREST },
      common: {
        mag: gl.NEAREST,
        min: gl.LINEAR,
        format: gl.LUMINANCE,
        type: gl.UNSIGNED_BYTE,
        src: new Uint8Array([
          0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc,
          0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc,
          0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff,
          0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff,
          0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
          0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
        ]),
        width: 8,
        height: 8,
      },
    });
  }, []);

  const render = useCallback((config: ISettingInfo) => {
    const gl = glRef.current as WebGLRenderingContext;
    const { programInfo, colorProgramInfo } = programInfosRef.current;
    const { hftIcon, common } = textureRef.current;
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = gl.canvas.width / gl.canvas.height;

    const fieldOfViewRadians = deg2radians(45);
    const projectionMatrix = m4.perspective(
      fieldOfViewRadians,
      aspect,
      1,
      2000
    );
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(config.eyePosition, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);
    const cubeLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        numComponents: 3,
        data: [
          -1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1,
          1, 1, 1, 1, 1,
        ],
      },
      indices: {
        numComponents: 2,
        data: [
          0, 1, 1, 3, 3, 2, 2, 0,

          4, 5, 5, 7, 7, 6, 6, 4,

          0, 4, 1, 5, 3, 7, 2, 6,
        ],
      },
    });
    const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 1, 10, 10);
    const planeBufferInfo = primitives.createPlaneBufferInfo(gl, 20, 20);

    const textureWorldMatrix = m4.lookAt(config.position, config.target, up);
    const proAspect = setting.projWidth / setting.projHeight;
    let textureProjectionMatrix = m4.perspective(
      fieldOfViewRadians,
      proAspect,
      0.1,
      200
    );
    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, [0.5, 0.5, 0.5]);
    textureMatrix = m4.scale(textureMatrix, [0.5, 0.5, 0.5]);
    textureMatrix = m4.multiply(textureMatrix, textureProjectionMatrix);

    textureMatrix = m4.multiply(textureMatrix, m4.inverse(textureWorldMatrix));
    const sphereUniforms = {
      u_colorMult: [1, 0.5, 0.5, 1],
      u_texture: common,
      u_world: m4.translation([2, 3, 4]),
    };
    const planeUniforms = {
      u_colorMult: [1, 0.5, 0.5, 1],
      u_texture: common,
      u_world: m4.translation([0, 0, 0]),
    };
    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, {
      u_view: viewMatrix,
      u_projection: projectionMatrix,
      u_textureMatrix: textureMatrix,
      u_projectedTexture: hftIcon,
    });
    twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
    twgl.setUniforms(programInfo, sphereUniforms);
    twgl.drawBufferInfo(gl, sphereBufferInfo, gl.TRIANGLES);
    twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
    twgl.setUniforms(programInfo, planeUniforms);
    twgl.drawBufferInfo(gl, planeBufferInfo, gl.TRIANGLES);
    gl.useProgram(colorProgramInfo.program);
    twgl.setUniforms(colorProgramInfo, {
      u_projection: projectionMatrix,
      u_view: viewMatrix,
      u_world: m4.multiply(
        textureWorldMatrix,
        m4.inverse(textureProjectionMatrix)
      ),
      u_color: [0, 0, 0, 1],
    });
    // gl.dra
    // debugger;
    twgl.setBuffersAndAttributes(gl, colorProgramInfo, cubeLinesBufferInfo);
    // gl.drawElements(
    //   gl.LINES,
    //   cubeLinesBufferInfo.numElements,
    //   gl.UNSIGNED_SHORT,
    //   0
    // );
    twgl.drawBufferInfo(gl, cubeLinesBufferInfo, gl.LINES);
  }, []);

  useEffect(() => {
    // render(setting);
    setTimeout(() => render(setting), 1000);
  }, [setting]);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", left: 0, top: 0, width: 320 }}>
        <Slider />
      </Box>
      <canvas ref={cavRef} width={1200} height={800} />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={COLOR_VERTEX_ID} type="notjs">
        {colorVertexStr}
      </script>
      <script id={COLOR_FRAGMENT_ID} type="notjs">
        {colorFragmentStr}
      </script>
    </Box>
  );
}
