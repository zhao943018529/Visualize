import React, { useRef, useEffect } from "react";
import { Box } from "@mui/material";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";
const { primitives, m4 } = twgl;

const VERTEX_ID = "vertex-id";

const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec4 position;
    attribute vec2 texcoord;
    attribute vec3 normal;  

    uniform mat4 u_world;
    uniform mat4 u_projection;

    varying vec2 v_texcoord;
    varying vec3 v_position;

    void main() {
        gl_Position = u_projection * u_world * position;
        v_position = (u_world * position).xyz;
        v_texcoord = texcoord;
    }    
`;
const fragmentStr = `
    precision mediump float;

    uniform float u_fogNear;
    uniform float u_fogFar;
    uniform sampler2D u_texture;
    uniform vec4 u_fogColor;

    varying vec2 v_texcoord;
    varying vec3 v_position;

    void main() {
        vec4 color = texture2D(u_texture, v_texcoord);
        float len = length(v_position);
        float fogAmount = smoothstep(u_fogNear,u_fogFar,len);
        gl_FragColor = mix(color, u_fogColor, fogAmount);
    }

`;

export default function Fog() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl);
    const fogColor = [0.8, 0.9, 1, 1];
    const settings = {
      fov: 60,
      fogNear: 3.2,
      fogFar: 4.7,
    };

    const { clover } = twgl.createTextures(gl, {
      clover: { src: "/f-texture.png" },
    });

    let then = 0;
    function render(time: number) {
      time *= 0.001;
      then = time;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(fogColor[0], fogColor[1], fogColor[2], fogColor[3]);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(programInfo.program);
      const aspect = gl.canvas.width / gl.canvas.height;
      const fieldOfViewRadians = deg2radians(settings.fov);
      const projection = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

      let cameraMatrix = m4.rotationY(time);
    //   cameraMatrix = m4.translate(cameraMatrix, [0, 1, 0]);
      const viewMatrix = m4.inverse(cameraMatrix);

      for (let i = 0; i < 10; ++i) {
        let worldMatrix = m4.rotateY(viewMatrix, deg2radians((360 / 10) * i));
        // worldMatrix = m4.rotateX(worldMatrix, deg2radians(10));
        worldMatrix = m4.translate(worldMatrix, [0, 0, -5]);
        twgl.setUniforms(programInfo, {
          u_projection: projection,
          u_world: worldMatrix,
          u_fogNear: settings.fogNear,
          u_fogFar: settings.fogFar,
          u_texture: clover,
          u_fogColor: fogColor,
        });
        twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
        twgl.drawBufferInfo(gl, cubeBufferInfo);
      }

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas ref={cavRef} width={1200} height={1000} />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
    </Box>
  );
}
