import React, { useRef, useEffect } from "react";
import {
  createSphere2,
  createStone,
  transformIndicesToUnIndices,
} from "../../utils/geometry";
import {
  perspective,
  rotationY,
  rotationX,
  rotateX,
  rotateY,
  scalation,
  rotateZ,
  identity,
  lookAt,
  inverse,
  multiply,
  ortho,
  translate,
} from "../../utils/matrix";
import {
  getGraphContext,
  shaderHelper,
  programHelper,
  createColorForVertex,
} from "../../utils/index";
import Vector3 from "../../utils/vec3";

const vertexStr = `
    precision mediump float;
    attribute vec3 a_Position;
    attribute vec4 a_Color;
    varying vec4 v_Color;

    attribute vec3 a_Normal;
    varying vec3 v_Normal;

    uniform mat4 u_Matrix;

    varying vec3 v_Position;
    uniform mat4 u_NormalMatrix;
    uniform mat4 u_ModelMatrix;

    void main() {
        gl_Position = u_Matrix * vec4(a_Position, 1);
        v_Normal = mat3(u_NormalMatrix) * a_Normal;
        v_Position = vec3(u_ModelMatrix * vec4(a_Position, 1));
        v_Color = a_Color;
    }
`;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;
    uniform vec3 u_LightColor;
    uniform float u_AmbientFactor;
    uniform vec3 u_LightPosition;
    varying vec3 v_Position;
    varying vec3 v_Normal;

    void main() {
        vec3 ambient = u_AmbientFactor * u_LightColor;
        vec3 lightDirection = u_LightPosition - v_Position;
        float diffuseFactor = dot(normalize(-lightDirection), normalize(v_Normal));
        diffuseFactor = max(diffuseFactor, 0.0);
        vec3 diffuseLightColor = u_LightColor * diffuseFactor;
        gl_FragColor = v_Color * vec4((diffuseLightColor + ambient), 1);
    }
`;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function Ambient() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    let sphere = createStone(6, 10, 10, 12, 12);
    sphere = transformIndicesToUnIndices(sphere);
    createColorForVertex(sphere);
    const { positions, colors, normals } = sphere as Record<string, any>;
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const a_Normal = gl.getAttribLocation(program, "a_Normal");
    const u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
    const u_LightColor = gl.getUniformLocation(program, "u_LightColor");
    const u_AmbientFactor = gl.getUniformLocation(program, "u_AmbientFactor");
    const u_NormalMatrix = gl.getUniformLocation(program, "u_NormalMatrix");
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    const u_ModelMatrix = gl.getUniformLocation(program, "u_ModelMatrix");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    gl.enableVertexAttribArray(a_Normal);
    const aspect = cavElem.width / cavElem.height;
    const fieldOfViewRadians = 60;
    const projectionMatrix = perspective(
      fieldOfViewRadians,
      aspect,
      1,
      2000,
      null
    );
    const cameraPosition = new Vector3(0, 0, 12);
    const target = new Vector3(0, 0, 0);
    const upDirection = new Vector3(0, 1, 0);
    let modelMatrix = identity(null);
    const cameraMatrix = lookAt(cameraPosition, target, upDirection, null);
    const viewMatrix = inverse(cameraMatrix, null);
    const viewProjectionMatrix = multiply(projectionMatrix, viewMatrix, null);
    const per = ortho(-aspect * 25, aspect * 25, -25, 25, 100, -100, null);
    gl.uniformMatrix4fv(u_Matrix, false, per);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    let xAngle = 0;
    function update() {
      ++xAngle;
      if (xAngle >= 360) {
        xAngle = 0;
      }
      gl.uniform1f(u_AmbientFactor, 0.5);
      gl.uniform3f(u_LightPosition, 0, 0, 20);
      gl.uniform3f(u_LightColor, 1, 1, 1);
      modelMatrix = rotationY((Math.PI / 180) * 0, null);
      modelMatrix = rotateX(modelMatrix, (Math.PI / 180) * xAngle);
      modelMatrix = rotateZ(modelMatrix, (Math.PI / 180) * 10);
      modelMatrix = multiply(modelMatrix, scalation(1, 1, 1, null), null);
      modelMatrix = translate(modelMatrix, 0, 0, 0, null);
      let uMatrix = multiply(
        per,
        multiply(viewMatrix, modelMatrix, null),
        null
      );
      gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix);
      gl.uniformMatrix4fv(u_NormalMatrix, false, modelMatrix);
      gl.uniformMatrix4fv(u_Matrix, false, uMatrix);
    }
    function render() {
      update();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (positions.length <= 0) return;
      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

      requestAnimationFrame(render);
    }
    render();
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
