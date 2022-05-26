import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  render,
  loadImageTexure,
} from "../../utils";

const vertexStr = `
  //浮点数设置为中等精度
  precision mediump float;
  attribute vec2 a_Position;
  uniform vec2 u_Screen_Size;
  varying vec2 v_Uv;
  attribute vec2 a_Uv;

  void main(){
      vec2 position = (a_Position / u_Screen_Size) * 2.0 - 1.0;
      position = position * vec2(1.0, -1.0);
      gl_Position = vec4(position, 0, 1);
      v_Uv = a_Uv;
  }
`;

const fragmentStr = `
  //浮点数设置为中等精度
  precision mediump float;
  varying vec2 v_Uv;
  uniform sampler2D u_Texture;
  void main(){
      // 点的最终颜色。
      gl_FragColor = texture2D(u_Texture, vec2(v_Uv.x, v_Uv.y));
  }
`;

export default function Texture() {
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
    gl.useProgram(program);
    const positions = [
      30,
      30,
      0,
      0, //V0
      30,
      300,
      0,
      1, //V1
      300,
      300,
      1,
      1, //V2
      30,
      30,
      0,
      0, //V0
      300,
      300,
      1,
      1, //V2
      300,
      30,
      1,
      0, //V3
    ];
    // gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    const u_Texture = gl.getUniformLocation(
      program,
      "u_Texture"
    ) as WebGLUniformLocation;
    const a_Screen_Size = gl.getUniformLocation(program, "u_Screen_Size");
    gl.uniform2f(a_Screen_Size, 800, 600);
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Uv = gl.getAttribLocation(program, "a_Uv");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Uv);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(a_Uv, 2, gl.FLOAT, false, 16, 8);
    loadImageTexure(gl, "/wave.jpg", u_Texture, () =>
      render(gl, gl.TRIANGLES, positions.length / 4)
    );
  }, []);

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
