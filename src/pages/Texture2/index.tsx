import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  render,
  loadImageTexure,
  loadCubeImages,
  randomColor2,
} from "../../utils";
import { deg2radians } from "../../utils/math";
import { createCube, transformIndicesToUnIndices } from "../../utils/geometry";
import {
  lookAt,
  perspective,
  multiply,
  inverse,
  identity,
  rotationX,
  rotationY,
  rotateX,
} from "../../utils/matrix";
import Vector3 from "../../utils/vec3";

const vertexStr = `
  //浮点数设置为中等精度
  precision mediump float;
  attribute vec3 a_Position;
  uniform mat4 u_Matrix;
  varying vec3 textCoord;

  void main(){
      gl_Position = u_Matrix * vec4(a_Position, 1);
      textCoord = vec3(-a_Position.x, a_Position.y, a_Position.z);
  }
`;

const fragmentStr = `
  //浮点数设置为中等精度
  precision mediump float;
  varying vec3 textCoord;
  uniform samplerCube u_Skybox;

  void main(){
      // 点的最终颜色。
      gl_FragColor = textureCube(u_Skybox, normalize(textCoord));
  }
`;

const alphaArr = ["G", "R", "A", "P", "H", "I", "C"];
function generateFace(text?: string) {
  text = text || alphaArr[Math.floor(Math.random() * alphaArr.length)];
  const cavElem = document.createElement("canvas");
  const CAV_WIDTH = 512;
  const CAV_HEIGHT = 512;
  cavElem.width = CAV_WIDTH;
  cavElem.height = CAV_HEIGHT;
  const ctx = cavElem.getContext("2d") as CanvasRenderingContext2D;
  const rColor = randomColor2();
  ctx.fillStyle = `rgba(${rColor.r},${rColor.g},${rColor.b},${rColor.a})`;
  ctx.fillRect(0, 0, CAV_WIDTH, CAV_HEIGHT);
  ctx.font = "100px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rColor1 = randomColor2();
  ctx.fillStyle = `rgba(${rColor1.r},${rColor1.g},${rColor1.b},${rColor1.a})`;
  ctx.fillText(text, CAV_WIDTH / 2, CAV_HEIGHT / 2);

  return cavElem;
}

export default function Texture() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const listRef = useRef<number[]>([]);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    const { positions } = transformIndicesToUnIndices(createCube(1, 1, 1));
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    const u_Skybox = gl.getUniformLocation(program, "u_Skybox");
    gl.enableVertexAttribArray(a_Position);

    const positionsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 12, 0);

    const fieldOfViewRadians = deg2radians(60);
    const { width, height } = cavElem;
    const aspect = width / height;
    const projectionMatrix = perspective(
      fieldOfViewRadians,
      aspect,
      1,
      2000,
      null
    );

    let xAngle = 0;
    let yAngle = 0;
    let lastMatrix = identity(null);
    gl.enable(gl.CULL_FACE);

    let then = 0;
    function render(time: number) {
      time *= 0.001;
      let deltaTime = time - then;
      then = time;
      gl.viewport(0, 0, width, height);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // ++xAngle;
      // ++yAngle;
      const cameraPosition = new Vector3(
        Math.cos(time * 0.1) * 2,
        0,
        Math.sin(time * 0.1) * 2
      );
      const target = new Vector3(0, 0, -1);
      // target.x = Math.cos(deg2radians(xAngle)) * Math.cos(deg2radians(yAngle));
      // target.y = Math.sin(deg2radians(xAngle));
      // target.z = Math.cos(deg2radians(xAngle)) * Math.sin(deg2radians(yAngle));
      const up = new Vector3(0, 1, 0);
      const cameraMatrix = lookAt(cameraPosition, target, up, null);
      const viewMatrix = inverse(cameraMatrix, null);
      // let currentMatrix = identity(null);
      // rotationX(deg2radians(xAngle), currentMatrix);
      // const yMatrix = rotationY(deg2radians(yAngle), null);
      // multiply(currentMatrix, yMatrix, lastMatrix);
      const worldMatrix = rotationX(deg2radians(time * 0.11), null);
      const uMatrix = multiply(projectionMatrix, viewMatrix, null);
      // gl.depthFunc(gl.LESS);
      gl.depthFunc(gl.LEQUAL);
      gl.uniformMatrix4fv(u_Matrix, false, uMatrix);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
      requestAnimationFrame(render);
    }
    // [
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    // ].forEach((type) => {
    //   gl.texImage2D(type, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, generateFace());
    // });

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u_Skybox, 0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    loadCubeImages([
      "/right.JPG",
      "/left.JPG",
      "/up.JPG",
      "/down.JPG",
      "/back.JPG",
      "/front.JPG",
    ]).then((images) => {
      images.forEach((image, index) => {
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + index,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        );
      });
      render(0);

      //   // gl.texImage2D(
      //   //   gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      //   //   0,
      //   //   gl.RGB,
      //   //   gl.RGB,
      //   //   gl.UNSIGNED_BYTE,
      //   //   front
      //   // );
      //   // gl.texImage2D(
      //   //   gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      //   //   0,
      //   //   gl.RGB,
      //   //   gl.RGB,
      //   //   gl.UNSIGNED_BYTE,
      //   //   front
      //   // );
      //   // gl.texImage2D(
      //   //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      //   //   0,
      //   //   gl.RGB,
      //   //   gl.RGB,
      //   //   gl.UNSIGNED_BYTE,
      //   //   front
      //   // );
      //   // gl.texImage2D(
      //   //   gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      //   //   0,
      //   //   gl.RGB,
      //   //   gl.RGB,
      //   //   gl.UNSIGNED_BYTE,
      //   //   front
      //   // );
      //   // gl.texImage2D(
      //   //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      //   //   0,
      //   //   gl.RGB,
      //   //   gl.RGB,
      //   //   gl.UNSIGNED_BYTE,
      //   //   front
      //   // );
    });
    // gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    // const u_Texture = gl.getUniformLocation(
    //   program,
    //   "u_Texture"
    // ) as WebGLUniformLocation;
    // const a_Screen_Size = gl.getUniformLocation(program, "u_Screen_Size");
    // gl.uniform2f(a_Screen_Size, 800, 600);
    // const a_Position = gl.getAttribLocation(program, "a_Position");
    // const a_Uv = gl.getAttribLocation(program, "a_Uv");
    // gl.enableVertexAttribArray(a_Position);
    // gl.enableVertexAttribArray(a_Uv);
    // const buffer = gl.createBuffer();
    // gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    // gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 16, 0);
    // gl.vertexAttribPointer(a_Uv, 2, gl.FLOAT, false, 16, 8);
    // loadImageTexure(gl, "/wave.jpg", u_Texture, () =>
    //   render(gl, gl.TRIANGLES, positions.length / 4)
    // );
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <canvas ref={cavRef} width={800} height={800} />
    </div>
  );
}
