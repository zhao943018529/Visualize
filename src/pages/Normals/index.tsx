import React, { useRef, useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import {
  createCube,
  createCone,
  transformIndicesToUnIndices,
} from "../../utils/geometry";
import Vector3 from "../../utils/vec3";
import {
  perspective,
  lookAt,
  identity,
  translate,
  translation,
  rotateX,
  rotateY,
  rotateZ,
  rotationX,
  rotationY,
  rotationZ,
  multiply,
  inverse,
} from "../../utils/matrix";
import {
  programHelper,
  getGraphContext,
  shaderHelper,
} from "../../utils/index";
import { deg2radians } from "../../utils/math";

import styles from "./index.module.scss";

const vertexStr = `
  precision mediump float;

  attribute vec3 a_Position;
  attribute vec4 a_Color;
  attribute vec3 a_Normal;
  varying vec4 v_Color;
  varying vec3 v_Normal;
  varying vec3 v_Position;
  uniform mat4 u_Matrix;
  uniform mat4 u_NormalMatrix;

  void main() {
    gl_Position = u_Matrix * vec4(a_Position, 1);
    v_Normal = mat3(u_NormalMatrix) * a_Normal;
    v_Position = vec3(u_NormalMatrix * vec4(a_Position, 1));
    v_Color = a_Color;
  }
`;

const fragmentStr = `
  precision mediump float;

  uniform vec3 u_LightDirection;
  uniform vec3 u_LightColor;
  uniform float u_AmbientFactor;
  varying vec4 v_Color;
  varying vec3 v_Normal;
  varying vec3 v_Position;
  uniform vec3 u_ViewPosition;
  uniform vec3 u_specularColor;

  void main() {
    vec3 ambientColor = u_AmbientFactor * u_LightColor;
    vec3 surfaceToView = normalize(u_ViewPosition - v_Position);
    vec3 lightDirection = normalize(u_LightDirection - v_Position);
    vec3 halfVector = normalize(surfaceToView + lightDirection);
    float diffuseFactor = dot(lightDirection, normalize(v_Normal));
    diffuseFactor = max(diffuseFactor, 0.0);
    vec3 diffuseLightColor = u_LightColor * diffuseFactor; 
    
    float specular = 0.0;
    if(diffuseFactor > 0.0){
      specular = pow(dot(v_Normal, halfVector), 2.33);
    }
    gl_FragColor = v_Color * vec4(ambientColor, 1);

    gl_FragColor.rgb +=specular * u_specularColor;
  }
`;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 640;
const RADIUS = 80;

export default function Alpha() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const programRef = useRef<WebGLProgram>();
  const [angle, setAngle] = useState<number>(0);
  const [xAngle, setXAngle] = useState<number>(0);
  const [cubeData] = useState(() =>
    transformIndicesToUnIndices(createCube(5, 10, 5))
  );

  const handleChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setAngle(newValue as number);
    },
    []
  );
  const handleXChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setXAngle(newValue as number);
    },
    []
  );

  const drawScene = useCallback((val: number, val2: number) => {
    const gl = glRef.current as WebGLRenderingContext;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cavElem = gl.canvas;
    const program = programRef.current as WebGLProgram;

    const aspect = cavElem.width / cavElem.height;
    const fieldOfViewRadians = 60;
    const zNear = 1;
    const zFar = 2000;

    const projectionMatrix = perspective(
      fieldOfViewRadians,
      aspect,
      zNear,
      zFar,
      null
    );

    // let currentMatrix = identity(null);
    // translation( 0, 0,RADIUS, currentMatrix);
    // rotationY(deg2radians(val), currentMatrix);

    let currentMatrix = rotationY(deg2radians(val), null);
    // currentMatrix = rotationX(deg2radians(val2), null);
    currentMatrix = multiply(
      currentMatrix,
      rotationX(deg2radians(val2), null),
      null
    );
    currentMatrix = translate(currentMatrix, 0, 0, RADIUS * 1.5, null);
    console.log(currentMatrix);
    // console.log(val);
    const target = new Vector3(RADIUS, 0, -1);
    const cameraPosition = new Vector3(
      currentMatrix[12],
      currentMatrix[13],
      currentMatrix[14]
    );
    const u_ViewPosition = gl.getUniformLocation(program, "u_ViewPosition");
    gl.uniform3fv(u_ViewPosition, [
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z,
    ]);
    const up = new Vector3(0, 1, 0);
    let cameraMatrix = lookAt(cameraPosition, target, up, null);
    // const rotationMatrix = rotationY(deg2radians(val), null);
    // multiply(currentMatrix, rotationMatrix, currentMatrix);
    const viewMatrix = inverse(cameraMatrix, null);
    // rotaY(deg2radians(val), viewMatrix);
    const uMatrix = multiply(projectionMatrix, viewMatrix, null);
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    const u_NormalMatrix = gl.getUniformLocation(program, "u_NormalMatrix");
    for (let i = 0; i < 5; ++i) {
      const curVal = (Math.PI * 2 * i) / 5;
      const x = Math.cos(curVal) * RADIUS;
      const z = Math.sin(curVal) * RADIUS;
      const curMatrix = translate(uMatrix, x, 0, z, null);
      const normalMatrix = identity(null);
      rotationY(curVal, normalMatrix);
      translation(x, 0, z, normalMatrix);
      gl.uniformMatrix4fv(u_Matrix, false, curMatrix);
      gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix);
      gl.drawArrays(gl.TRIANGLES, 0, cubeData.positions.length / 3);
    }
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    // var compiled = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    // console.log("Shader compiled successfully: " + compiled);
    // var compilationLog = gl.getShaderInfoLog(fragmentShader);
    // console.log("Shader compiler log: " + compilationLog);
    programRef.current = program;
    gl.useProgram(program);
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const a_Normal = gl.getAttribLocation(program, "a_Normal");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    gl.enableVertexAttribArray(a_Normal);
    const u_LightDirection = gl.getUniformLocation(program, "u_LightDirection");
    const u_LightColor = gl.getUniformLocation(program, "u_LightColor");
    const u_AmbientFactor = gl.getUniformLocation(program, "u_AmbientFactor");
    const u_specularColor = gl.getUniformLocation(program, "u_specularColor");

    gl.uniform3f(u_LightDirection, RADIUS * 1.5, RADIUS, -RADIUS * 1.5);
    gl.uniform3f(u_LightColor, 1, 1, 1);
    gl.uniform1f(u_AmbientFactor, 0.5);
    gl.uniform3fv(u_specularColor, [1, 0.6, 0.6]);

    // const cube = transformIndicesToUnIndices(createCube(5, 10, 5));
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeData.positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      cubeData.colors as Float32Array,
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(a_Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeData.normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    drawScene(angle, xAngle);
  }, [cubeData]);

  useEffect(() => {
    drawScene(angle, xAngle);
  }, [angle, xAngle]);

  return (
    <Box className={styles.alphaRoot} sx={{ position: "relative" }}>
      <Box
        position="absolute"
        sx={{
          position: "absolute",
          top: 0,
          right: 20,
          width: 280,
          background: "#fff",
        }}
      >
        <Slider value={angle} onChange={handleChange} min={0} max={360} />
        <Slider value={xAngle} onChange={handleXChange} min={0} max={360} />
      </Box>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
    </Box>
  );
}
