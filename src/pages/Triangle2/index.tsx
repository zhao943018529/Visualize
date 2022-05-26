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
    varying vec4 v_Color;
    
    void main(){
       vec2 position = (a_Position / a_Screen_Size) * 2.0 - 1.0;
       position = position  * vec2(1.0, -1.0);
       gl_Position = vec4(position, 0.0, 1.0);
       v_Color = a_Color;
    }
`;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;

    void main(){
        vec4 color = v_Color / vec4(255, 255, 255, 1);
        gl_FragColor = color;
    }
`;

export default function Triangle2() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    // const color = randomColor();
    // const u_Color = gl.getUniformLocation(program, "u_Color");
    // gl.uniform4f(u_Color, color[0], color[1], color[2], color[3]);
    const a_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    gl.vertexAttrib2f(a_Screen_Size, 600, 400);
    const positions = [
      //V0
      30, 30, 255, 0, 0, 1,
      //V1
      30, 300, 0, 255, 0, 1,
      //V2
      300, 300, 0, 255, 0, 1,
      //V3
      300, 30, 0, 0, 255, 1,
    ];
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 24, 8);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const indices = [0, 1, 2, 0, 2, 3];
    const indicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }, []);

  return (
    <div style={{ margin: "120px auto" }}>
      <canvas ref={cavRef} style={{ width: 600, height: 400 }} />
    </div>
  );
}
