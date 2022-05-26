import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  render,
} from "../../utils";

const vertexStr = `
    precision mediump float;
    attribute vec2 a_Position;
    attribute vec2 a_Screen_Size;

    void main(){
        vec2 position =  (a_Position / a_Screen_Size) * 2.0 - 1.0;
        position  = position * vec2(1.0, -1.0);
        gl_Position = vec4(position, 0, 1);
    }
`;

const fragmentStr = `
    precision mediump float;
    uniform vec4 u_Color;
    
    void main() {
        vec4 color = u_Color / vec4(255, 255, 255, 1);
        gl_FragColor = color;
    }
`;

export default function Triangle() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const [points, setPoints] = useState<number[]>([]);
  const listRef = useRef<number[]>([]);

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
    const a_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    const u_Color = gl.getUniformLocation(program, "u_Color");
    gl.uniform4f(u_Color, 255, 0, 0, 1);
    gl.vertexAttrib2f(a_Screen_Size, 800, 600);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    // gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, []);

  const handleClick = useCallback((evt) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const { offsetLeft, offsetTop } = cavElem;
    const { pageX, pageY } = evt;
    const x = pageX - offsetLeft;
    const y = pageY - offsetTop;
    listRef.current.push(x, y);
    setPoints((prev) => {
      const newPoints = prev.slice(0);
      newPoints.push(x, y);
      return newPoints;
    });
  }, []);

  useEffect(() => {
    const gl = glRef.current as WebGLRenderingContext;
    if (points.length % 6 === 0) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
      render(gl, gl.TRIANGLES, points.length / 2);
    }
  }, [points]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <canvas ref={cavRef} onMouseUp={handleClick} width={800} height={600} />
    </div>
  );
}
