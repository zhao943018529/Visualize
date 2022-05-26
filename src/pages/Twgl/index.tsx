import React, { useRef, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import { Slider, Typography, Box } from "@mui/material";
import { createCube } from "../../utils/geometry";
import { deg2radians } from "../../utils/math";

const { m4 } = twgl;

const VERTEX_ID = "vertex-shader";
const FRAGMENT_ID = "fragment-shader";

const vertexStr = `
    uniform mat4 u_worldViewProjection;
    uniform vec3 u_lightWorldPos;
    uniform vec3 u_viewPos;
    uniform mat4 u_world;
    uniform mat4 u_inverseView;
    uniform mat4 u_worldInverseTranspose;

    attribute vec4 position;
    attribute vec3 normal;
    attribute vec2 texcoord;

    varying vec4 v_position;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToView;
    varying vec3 v_surfaceToLight;

    void main() {
        v_texCoord = texcoord;
        v_position = u_worldViewProjection * position;
        v_normal = mat3(u_worldInverseTranspose) * normal;
        v_surfaceToLight = u_lightWorldPos - (u_world * position).xyz;
        v_surfaceToView = (u_inverseView[3] - (u_world * position)).xyz;
        gl_Position = v_position;
    }
`;
const fragmentStr = `
    precision mediump float;

    varying vec4 v_position;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToView;
    varying vec3 v_surfaceToLight;

    // 环境光 factor
    uniform vec4 u_ambient;
    uniform float u_shininess;
    uniform vec4 u_lightColor;
    uniform samplerCube u_diffuse;
    uniform vec4 u_specular;
    uniform float u_specularFactor;

    vec4 lit(float l,float h,float m){
        return vec4(1.0,max(l ,0.0),(l > 0.0) ? pow(max(h, 0.0), m) : 0.0 ,1.0);
    }

    void main() {
      vec3 a_normal = normalize(v_normal);
      vec3 surfaceToView = normalize(v_surfaceToView);
      vec3 surfaceToLight = normalize(v_surfaceToLight);
      vec4 diffuseColor = textureCube(u_diffuse,  v_position.xyz);
      vec3 halfVector = normalize(surfaceToView + surfaceToLight);
      vec4 litR = lit(dot(a_normal ,surfaceToLight) ,dot(a_normal ,surfaceToView) ,u_shininess);
      vec4 outColor = vec4((diffuseColor * litR.y + diffuseColor * u_ambient + 
      u_specular * litR.z * u_specularFactor).rgb ,diffuseColor.a);
      gl_FragColor = diffuseColor;
    }
`;

export default function Twgl() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = cavElem.getContext("webgl") as WebGLRenderingContext;
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const { positions, indices, normals, texcoords, colors } = createCube(
      40,
      40,
      40
    );
    const arrays = {
      position: positions,
      normal: normals,
      texcoord: texcoords,
      indices,
    };
    // const bufferInfo = twgl.primitives.createCubeBufferInfo(gl, 20);
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    const tex = twgl.createTexture(gl, {
      target: gl.TEXTURE_CUBE_MAP,
      src: [
        "/up.JPG",
        "/right.JPG",
        "/down.JPG",
        "/left.JPG",
        "/back.JPG",
        "/front.JPG",
      ],
    });
    const uniforms: Record<string, any> = {
      u_lightWorldPos: [30, 80, -100],
      u_lightColor: [1, 0.8, 0.8, 1],
      u_ambient: [0, 0, 0, 1],
      u_specular: [1, 1, 1, 1],
      u_shininess: 50,
      u_diffuse: tex,
    };

    function drawScene(time: number) {
      time *= 0.001;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.FRONT);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const fov = (60 * Math.PI) / 180;
      const aspect = gl.canvas.width / gl.canvas.height;
      const zNear = 0.5;
      const zFar = 2000;
      const projectionMatrix = m4.perspective(fov, aspect, zNear, zFar);
      const eyePos = [0, 0, 0];
      const target = [
        Math.cos(deg2radians(time)) * Math.cos(deg2radians(time)),
        Math.sin(deg2radians(time)),
        Math.cos(deg2radians(uniforms.xRotation)) * Math.sin(deg2radians(time)),
      ];
      const up = [0, 1, 0];
      const cameraMatrix = m4.lookAt(eyePos, target, up);
      const viewMatrix = m4.inverse(cameraMatrix);
      const viewProjection = m4.multiply(projectionMatrix, viewMatrix);
      const worldMatrix = m4.multiply(m4.rotationY(time), m4.rotationX(time));
      //   const worldMatrix = m4.rotationX(time);

      uniforms.u_viewInverse = cameraMatrix;
      uniforms.u_world = worldMatrix;
      uniforms.u_worldInverseTranspose = m4.transpose(m4.inverse(worldMatrix));
      uniforms.u_worldViewProjection = m4.multiply(viewProjection, worldMatrix);
      gl.useProgram(programInfo.program);
      twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
      twgl.setUniforms(programInfo, uniforms);
      gl.drawElements(
        gl.TRIANGLES,
        bufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
      requestAnimationFrame(drawScene);
    }
    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <canvas ref={cavRef} width={1000} height={800}></canvas>
    </div>
  );
}
