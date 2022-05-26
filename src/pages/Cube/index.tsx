import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  renderElements,
  loadImageTexure,
  createCube,
} from "../../utils";
// import "../../utils/math.js";
// import "../../utils/vec3.js";
// import "../../utils/matrix.js";
//uniform mat4 u_Matrix;attribute vec4 a_Color;varying vec4 v_Color;
const vertexStr = `
    precision mediump float;
    attribute vec3 a_Position;
    uniform vec3 u_Screen_Size;
    
    void main(){
      vec3 position = (a_Position / u_Screen_Size) * 2.0 - 1.0;
      position = vec3(1.0, -1.0, 1.0) * position;
      gl_Position = vec4(position, 1.0);
    }
`;

//varying vec4 v_Color;
const fragmentStr = `
  //浮点数设置为中等精度
  precision mediump float;

  void main(){
      // 点的最终颜色。
      gl_FragColor = vec4(56, 156, 76, 1);
  }
`;

declare const matrix: any;
declare const lib3d: any;

export default function Cube() {
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
    let positions = [
      -0.5, -0.5, 0.5, 1, 0, 0, 1, 0.5, -0.5, 0.5, 1, 0, 0, 1, 0.5, 0.5, 0.5, 1,
      0, 0, 1, -0.5, 0.5, 0.5, 1, 0, 0, 1,

      -0.5, 0.5, 0.5, 0, 1, 0, 1, -0.5, 0.5, -0.5, 0, 1, 0, 1, -0.5, -0.5, -0.5,
      0, 1, 0, 1, -0.5, -0.5, 0.5, 0, 1, 0, 1,

      0.5, 0.5, 0.5, 0, 0, 1, 1, 0.5, -0.5, 0.5, 0, 0, 1, 1, 0.5, -0.5, -0.5, 0,
      0, 1, 1, 0.5, 0.5, -0.5, 0, 0, 1, 1,

      0.5, 0.5, -0.5, 1, 0, 1, 1, 0.5, -0.5, -0.5, 1, 0, 1, 1, -0.5, -0.5, -0.5,
      1, 0, 1, 1, -0.5, 0.5, -0.5, 1, 0, 1, 1,

      -0.5, 0.5, 0.5, 1, 1, 0, 1, 0.5, 0.5, 0.5, 1, 1, 0, 1, 0.5, 0.5, -0.5, 1,
      1, 0, 1, -0.5, 0.5, -0.5, 1, 1, 0, 1,

      -0.5, -0.5, 0.5, 0, 1, 1, 1, -0.5, -0.5, -0.5, 0, 1, 1, 1, 0.5, -0.5,
      -0.5, 0, 1, 1, 1, 0.5, -0.5, 0.5, 0, 1, 1, 1,
    ];

    let indices = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
      14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ];
    // const a_Screen_Size = gl.getUniformLocation(program, "u_Screen_Size");
    // gl.uniform2f(a_Screen_Size, 800, 600);
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const u_Screen_Size = gl.getUniformLocation(program, "u_Screen_Size");
    gl.uniform3f(u_Screen_Size, 800, 600, 100);
    // const a_Color = gl.getAttribLocation(program, "a_Color");
    // debugger;
    // const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    gl.enableVertexAttribArray(a_Position);
    // gl.enableVertexAttribArray(a_Color);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 12, 0);
    const indicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );
    // const colorsBuffer = gl.createBuffer();
    // gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
    // gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    // gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 16, 0);
    // gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //隐藏背面
    // gl.enable(gl.CULL_FACE);
    renderElements(gl, indices.length);
    // var aspect = 800 / 600;
    // //计算正交投影矩阵
    // var projectionMatrix = matrix.ortho(
    //   -aspect * 4,
    //   aspect * 4,
    //   -4,
    //   4,
    //   100,
    //   -100
    // );
    // var deg2radians = lib3d.math.deg2radians;
    // var dstMatrix = matrix.identity();
    // /*渲染*/
    // function render() {
    //   xAngle += 1;
    //   yAngle += 1;
    //   //先绕 Y 轴旋转矩阵。
    //   matrix.rotationY(deg2radians(yAngle), dstMatrix);
    //   //再绕 X 轴旋转
    //   matrix.multiply(
    //     dstMatrix,
    //     matrix.rotationX(deg2radians(xAngle), tmpMatrix),
    //     dstMatrix
    //   );
    //   //模型投影矩阵。
    //   matrix.multiply(projectionMatrix, dstMatrix, dstMatrix);

    //   gl.uniformMatrix4fv(u_Matrix, false, dstMatrix);
    //   gl.clear(gl.COLOR_BUFFER_BIT);
    //   gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    //   if (!playing) {
    //     return;
    //   }
    // requestAnimationFrame(render);
    // }

    // var playing = false;
    // var xAngle = 0;
    // var yAngle = 0;
    // var dstMatrix = matrix.identity();
    // var tmpMatrix = matrix.identity();
    // document.body.addEventListener("click", function () {
    //   playing = !playing;
    //   render();
    // });
    // render();
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
