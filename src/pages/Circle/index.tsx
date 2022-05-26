import React, { useRef, useState, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  renderElements,
  loadImageTexure,
  createCube,
  randomColor,
} from "../../utils";

const vertexStr = `
    precision mediump float;

    attribute vec2 a_Position;
    attribute vec2 a_Screen_Size;
    attribute vec4 a_Color;
    attribute vec2 a_Uv;
    varying vec4 v_Color;
    varying vec2 v_Uv;
    
    void main(){
       vec2 position = (a_Position / a_Screen_Size) * 2.0 - 1.0;
       position = position  * vec2(1.0, -1.0);
       gl_Position = vec4(position, 0.0, 1.0);
       v_Color = a_Color;
       v_Uv = a_Uv;
    }
`;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;
    varying vec2 v_Uv;
    uniform sampler2D u_Texture;

    void main(){
        gl_FragColor = texture2D(u_Texture, vec2(v_Uv.x, v_Uv.y));
    }
`;

function createCircle(x: number, y: number, radius: number, n: number) {
  const positions = [x, y, 0, 255, 0, 1];
  for (let i = 0; i <= n; ++i) {
    const angle = (Math.PI * 2 * i) / n;
    positions.push(
      Math.cos(angle) * radius + x,
      Math.sin(angle) * radius + y,
      255,
      0,
      0,
      1
    );
  }

  return positions;
}

function createTextureCircle(x: number, y: number, radius: number, n: number) {
  const positions = [x, y, 0, 0];
  for (let i = 0; i <= n; ++i) {
    const angle = (Math.PI * 2 * i) / n;
    const newX = Math.cos(angle) * radius + x;
    const newY = Math.sin(angle) * radius + y;
    positions.push(
      newX,
      newY,
      (Math.cos(angle) * radius + radius) / (radius * 2),
      (Math.sin(angle) * radius + radius) / (radius * 2)
    );
  }

  return positions;
}

export default function Triangle3() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    const a_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    gl.vertexAttrib2f(a_Screen_Size, 600, 400);
    const positions = createTextureCircle(200, 200, 100, 100);
    const positions2 = [
      //V0
      165, 165, 255, 255, 0, 1,
      //V1
      30, 30, 255, 0, 0, 1,
      //V2
      30, 300, 255, 255, 0, 1,
      //V3
      300, 300, 255, 0, 0, 1,
      //V4
      300, 30, 0, 0, 255, 1,
      //V5
      30, 30, 0, 255, 0, 1,
    ];
    console.log(positions);
    const a_Uv = gl.getAttribLocation(program, "a_Uv");
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const u_Texture = gl.getUniformLocation(
      program,
      "u_Texture"
    ) as WebGLUniformLocation;
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Uv);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(a_Uv, 2, gl.FLOAT, false, 16, 8);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positions),
      gl.STATIC_DRAW
    );
    // const indices = positions.map(());
    // console.log(indices);
    // const indicesBuffer = gl.createBuffer();
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    // gl.bufferData(
    //   gl.ELEMENT_ARRAY_BUFFER,
    //   new Uint16Array(indices),
    //   gl.STATIC_DRAW
    // );
    gl.clearColor(0, 0, 0, 1);
    loadImageTexure(gl, "/wave.jpg", u_Texture, () => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, positions.length / 4);
    });

    // gl.drawElements(gl.TRIANGLE_FAN, indices.length, gl.UNSIGNED_SHORT, 0);
  }, []);

  return (
    <div style={{ margin: "120px auto" }}>
      <canvas ref={cavRef} style={{ width: 600, height: 400 }} />
    </div>
  );
}
