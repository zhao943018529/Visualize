import React, { useRef, useEffect, useCallback, useState } from "react";

import styles from "./index.module.css";

const vertexShaderStr = `
    precision mediump float;
    attribute vec2 a_Position;
    attribute vec2 a_Screen_Size;

    void main(){
        vec2 position = (a_Position / a_Screen_Size) * 2.0 - 1.0;
        position = position * vec2(1.0,-1.0);
        gl_Position = vec4(position, 0.0, 1.0);
        gl_PointSize = 10.0;
    }
`;

const fragmentShaderStr = `
    precision mediump float;
    uniform vec4 u_Color;

    void main(){
        vec4 color = u_Color / vec4(255, 255, 255, 1);
        gl_FragColor = color;
    }
`;

function randomColor() {
  return [Math.random() * 255, Math.random() * 255, Math.random() * 255, 1];
}

function getGraphContext(elem: HTMLCanvasElement) {
  return elem.getContext("webgl") || elem.getContext("experimental-webgl");
}

function shaderHelper(
  context: WebGLRenderingContext,
  type: number,
  shaderStr: string
) {
  const shaderTarget = context.createShader(type) as WebGLShader;
  context.shaderSource(shaderTarget, shaderStr);

  context.compileShader(shaderTarget);

  return shaderTarget;
}

function programHelper(
  ctx: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) {
  const program = ctx.createProgram() as WebGLProgram;
  ctx.attachShader(program, vertexShader);
  ctx.attachShader(program, fragmentShader);
  ctx.linkProgram(program);

  return program;
}

interface Point {
  x: number;
  y: number;
  color: number[];
}

export default function WebGL() {
  const [points, setPoints] = useState<Point[]>([]);
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const programRef = useRef<WebGLProgram>();

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexShaderStr);
    const fragmentShader = shaderHelper(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderStr
    );
    const program = programHelper(gl, vertexShader, fragmentShader);
    programRef.current = program;
    gl.useProgram(program);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }, []);

  useEffect(() => {
    const gl = glRef.current as WebGLRenderingContext;
    const program = programRef.current as WebGLProgram;
    let a_Position = gl.getAttribLocation(program, "a_Position");
    let s_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    let u_Color = gl.getUniformLocation(program, "u_Color");
    gl.vertexAttrib2f(s_Screen_Size, 800, 400);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    for (let i = 0; i < points.length; ++i) {
      const { x, y, color } = points[i];
      gl.uniform4f(u_Color, color[0], color[1], color[2], color[3]);
      gl.vertexAttrib2f(a_Position, x, y);
      gl.drawArrays(gl.POINTS, 0, 1);
    }
  }, [points]);

  const handleClick = useCallback((evt) => {
    const x = evt.pageX;
    const y = evt.pageY;

    setPoints((oldPoints) => {
      const newPoints = oldPoints.slice(0);
      newPoints.push({ x, y, color: randomColor() });

      return newPoints;
    });
  }, []);

  return (
    <div className={styles.webglRoot}>
      <canvas onClick={handleClick} ref={cavRef} width={800} height={600} />
    </div>
  );
}
