import React, { useState, useCallback, useRef, useEffect } from "react";
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
  transpose,
} from "../../utils/matrix";
import {
  programHelper,
  getGraphContext,
  shaderHelper,
} from "../../utils/index";
import { deg2radians } from "../../utils/math";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 720;

const vertexStr = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec4 a_Color;
    uniform mat4 u_Matrix;
    varying vec4 v_Color;
    attribute vec3 a_Normal;
    uniform mat4 u_NormalMatrix;
    uniform mat4 u_ModelMatrix;
    varying vec3 v_Position;
    varying vec3 v_Normal;

    void main() {
        gl_Position = u_Matrix * vec4(a_Position, 1);
        v_Position = mat3(u_NormalMatrix) * a_Position;
        v_Normal = mat3(u_NormalMatrix) * a_Normal;
        v_Color = a_Color;
    }
`;
const fragmentStr = `
    precision mediump float;


    varying vec3 v_Position;
    varying vec4 v_Color;
    uniform float u_Shininess;
    uniform vec3 u_LightPosition;
    uniform vec3 u_lightDirection;
    uniform vec3 u_viewWorldPosition;
    uniform vec4 u_Color;
    varying vec3 v_Normal;
    uniform float u_Limit;
    uniform float u_InnerLimit;
    uniform float u_OuterLimit;

    void main() {
        vec3 normal = normalize(v_Normal);
        vec3 surfaceToLight = u_LightPosition - v_Position;
        vec3 surfaceToView = u_viewWorldPosition - v_Position;
        vec3 halfVector = normalize(surfaceToLight + surfaceToView);
        float dotFromDirection = dot(normalize(surfaceToLight), normalize(-u_lightDirection));
        float limitRange = u_InnerLimit - u_OuterLimit;
        float inLight = clamp((dotFromDirection - u_OuterLimit) / limitRange, 0.0 , 1.0);
        float light = inLight * dot(normal, normalize(surfaceToLight));
        float specular = inLight * pow(dot(normal, normalize(halfVector)), u_Shininess);
        gl_FragColor = u_Color;
        gl_FragColor.rgb *= light;
        gl_FragColor.rgb +=specular;
    }
`;

const RADIUS = 100;

export default function SpotLight() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const programRef = useRef<WebGLProgram>();
  const [cubeData] = useState(() =>
    transformIndicesToUnIndices(createCube(RADIUS, RADIUS, RADIUS))
  );
  const [angle, setAngle] = useState<number>(0);
  const [limit, setLimit] = useState<number>(0);
  const [spotAngle, setSpotAngle] = useState<number>(0);

  const handleChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setAngle(newValue as number);
    },
    []
  );
  const handleLimitChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setLimit(newValue as number);
    },
    []
  );
  const handleSpotChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setSpotAngle(newValue as number);
    },
    []
  );

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    // var compiled = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    // console.log("Shader compiled successfully: " + compiled);
    // var compilationLog = gl.getShaderInfoLog(vertexShader);
    // console.log("Shader compiler log: " + compilationLog);
    const program = programHelper(gl, vertexShader, fragmentShader);
    programRef.current = program;
    gl.useProgram(program);

    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const a_Normal = gl.getAttribLocation(program, "a_Normal");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    gl.enableVertexAttribArray(a_Normal);

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
    const shininess = 150;
    const u_Shininess = gl.getUniformLocation(program, "u_Shininess");
    gl.uniform1f(u_Shininess, shininess);
    const u_Color = gl.getUniformLocation(program, "u_Color");
    gl.uniform4fv(u_Color, [0.2, 1, 0.2, 1]);
    const u_InnerLimit = gl.getUniformLocation(program, "u_InnerLimit");
    const u_OuterLimit = gl.getUniformLocation(program, "u_OuterLimit");
    gl.uniform1f(u_InnerLimit, 10);
    gl.uniform1f(u_OuterLimit, 30);
    gl.clearColor(0, 0, 0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }, []);

  const drawScene = useCallback(
    (limitValue: number, angleValue: number, spotValue: number) => {
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
      const cameraPosition = new Vector3(100, 200, 400);
      const u_viewWorldPosition = gl.getUniformLocation(
        program,
        "u_viewWorldPosition"
      );
      gl.uniform3fv(u_viewWorldPosition, [
        cameraPosition.x,
        cameraPosition.y,
        cameraPosition.z,
      ]);
      const target = new Vector3(0, 20, 0);
      const up = new Vector3(0, 1, 0);
      const cameraMatrix = lookAt(cameraPosition, target, up, null);
      const viewMatrix = inverse(cameraMatrix, null);

      let worldMatrix = multiply(
        rotationX(deg2radians(angleValue), null),
        rotationY(deg2radians(spotValue), null),
        null
      );
      const worldViewMatrix = multiply(viewMatrix, worldMatrix, null);
      const projectionWorldMatrix = multiply(
        projectionMatrix,
        worldViewMatrix,
        null
      );
      //   const projectionWorldMatrix2 = translate(
      //     projectionWorldMatrix,
      //     RADIUS,
      //     RADIUS,
      //     0,
      //     null
      //   );
      const uNormalMatrix = transpose(inverse(worldMatrix, null), null);
      const u_NormalMatrix = gl.getUniformLocation(program, "u_NormalMatrix");
      gl.uniformMatrix4fv(u_NormalMatrix, false, uNormalMatrix);
      const u_ModelMatrix = gl.getUniformLocation(program, "u_ModelMatrix");
      gl.uniformMatrix4fv(u_ModelMatrix, false, worldMatrix);
      const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
      gl.uniformMatrix4fv(u_Matrix, false, projectionWorldMatrix);
      const lightPosition = new Vector3(60, 80, RADIUS * 1.5);
      let lmat = lookAt(lightPosition, target, up, null);
      lmat = multiply(rotationX(deg2radians(0), null), lmat, null);
      console.log(lmat);
      const ttt = Vector3.subtractVectors(target, lightPosition);
      //   const lightDirection = [-lmat[8], -lmat[9], -lmat[10]];
      const lightDirection = [ttt.x, ttt.y, ttt.z];
      const u_lightDirection = gl.getUniformLocation(
        program,
        "u_lightDirection"
      );
      gl.uniform3fv(u_lightDirection, lightDirection);
      const u_Limit = gl.getUniformLocation(program, "u_Limit");
      gl.uniform1f(u_Limit, Math.cos(limitValue));
      const u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
      gl.uniform3f(
        u_LightPosition,
        lightPosition.x,
        lightPosition.y,
        lightPosition.z
      );
      gl.drawArrays(gl.TRIANGLES, 0, cubeData.positions.length / 3);
    },
    []
  );

  useEffect(() => {
    drawScene(limit, angle, spotAngle);
  }, [limit, angle, spotAngle]);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", right: 60, width: 280 }}>
        <Slider value={angle} onChange={handleChange} min={0} max={360} />
        <Slider value={limit} onChange={handleLimitChange} min={0} max={10} />
        <Slider
          value={spotAngle}
          onChange={handleSpotChange}
          min={0}
          max={360}
        />
      </Box>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
    </Box>
  );
}
