import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  render,
  createCirclePoints,
} from "../../utils";

const vertexStr = `
    precision mediump float;
    attribute vec2 a_Position;
    attribute vec2 a_Screen_Size;
		attribute vec4 a_Color;
		varying vec4 v_Color;

    void main(){
        vec2 position =  (a_Position / a_Screen_Size) * 2.0 - 1.0;
        position  = position * vec2(1.0, -1.0);
        gl_Position = vec4(position, 0, 1);
        v_Color = a_Color;
    }
`;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;

    void main() {
        vec4 color = v_Color / vec4(255, 255, 255, 1);
        gl_FragColor = color;
    }
`;

export default function Circle() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const [points, setPoints] = useState<number[]>([]);
  const listRef = useRef<number[]>([]);
  console.log("Wellcome to rectangle!!!");

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    // gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    const a_Position = gl.getAttribLocation(program, "a_Position");
    gl.enableVertexAttribArray(a_Position);
    const a_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttrib2f(a_Screen_Size, 800, 600);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const positions = createCirclePoints(100, 100, 100, 1000);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 24, 8);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, positions.length / 6);
  }, []);

  // const handleClick = useCallback((evt) => {
  //   const cavElem = cavRef.current as HTMLCanvasElement;
  //   const { offsetLeft, offsetTop } = cavElem;
  //   const { pageX, pageY } = evt;
  //   const x = pageX - offsetLeft;
  //   const y = pageY - offsetTop;
  //   listRef.current.push(x, y);
  //   setPoints((prev) => {
  //     const newPoints = prev.slice(0);
  //     newPoints.push(x, y);
  //     return newPoints;
  //   });
  // }, []);

  // useEffect(() => {
  //   const gl = glRef.current as WebGLRenderingContext;
  //   if (points.length % 6 === 0) {
  //     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
  //     render(gl, gl.TRIANGLES, points.length / 2);
  //   }
  // }, [points]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <canvas ref={cavRef} width={800} height={600} />
    </div>
  );
}
