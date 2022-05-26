import React, { useEffect, useRef } from "react";
import * as twgl from "twgl.js";
import {
  matIV,
  qtnIV,
  torus,
  sphere,
  cube,
  hsva,
} from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 960;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;

    void main() {
        gl_Position = vec4(position, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    uniform vec2 resolution;

    void main() {
        vec2 p = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
        gl_FragColor = vec4(p, 0.0, 0.0);
    }
`;

const POINT_VERTEX_ID = "point-vertex-id";
const POINT_FRAGMENT_ID = "point-fragment-id";

const pointVertexStr = `
    attribute float index;

    uniform vec2 resolution;
    uniform sampler2D u_texture;
    uniform float pointScale;

    void main() {
        vec2 p = vec2(
            mod(index, resolution.x) / resolution.x,
            floor(index / resolution.x) / resolution.y
        );
        vec4 t = texture2D(u_texture, p);
        gl_Position = vec4(t.xy, 0.0, 1.0);
        gl_PointSize = 0.1 + pointScale;    
    }
`;
const pointFragmentStr = `
    precision mediump float;

    uniform vec4 ambientColor;

    void main() {
        gl_FragColor = ambientColor;
    }
`;

const VELOCITY_VERTEX_ID = "velocity-vertex-id";
const VELOCITY_FRAGMENT_ID = "velocity-fragment-id";

const velocityVertexStr = `
    attribute vec3 position;
    void main(){
        gl_Position = vec4(position, 1.0);
    }
`;

const velocityFragmentStr = `
    precision mediump float;

    uniform vec2 resolution;
    uniform sampler2D u_texture;
    uniform vec2 mouse;
    uniform bool mouseFlag;
    uniform float velocity;

    const float SPEED = 0.05;

    void main(){
        vec2 p = gl_FragCoord.xy / resolution;
        vec4 t = texture2D(u_texture, p);
        vec2 v = normalize(mouse - t.xy) * 0.2;
        vec2 w = normalize(v + t.zw);
        vec4 destColor = vec4(t.xy + w * SPEED * velocity, w);
        if(!mouseFlag){
            destColor.zw = t.zw;   
        }
        gl_FragColor = destColor;
    }
`;

function createFrameBuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  format?: number
) {
  const textureFormat = format || gl.UNSIGNED_BYTE;
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const depthRenderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    depthRenderBuffer
  );
  const fTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    textureFormat,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    fTexture,
    0
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    fTexture,
    fb,
    width,
    height,
  };
}

export default function Particles() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const mouseInfo = useRef({
    mouse: [0.0, 0.0],
    run: true,
    mouseFlag: false,
  });

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const unit = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    console.log("UNIT: " + unit);
    const ext =
      gl.getExtension("OES_texture_float") ||
      gl.getExtension("OES_texture_half_float");
    if (ext == null) {
      console.log("float texture not supported");
      return;
    }
    const defaultProgramInfo = twgl.createProgramInfo(gl, [
      DEFAULT_VERTEX_ID,
      DEFAULT_FRAGMENT_ID,
    ]);
    const velocityProgramInfo = twgl.createProgramInfo(gl, [
      VELOCITY_VERTEX_ID,
      VELOCITY_FRAGMENT_ID,
    ]);
    const pointProgramInfo = twgl.createProgramInfo(gl, [
      POINT_VERTEX_ID,
      POINT_FRAGMENT_ID,
    ]);

    // 初始化planeBufferInfo
    const position = [
      -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0,
    ];
    // const indices = [0, 1, 2, 1, 3, 2];
    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 3,
      },
      //   indices: {
      //     data: indices,
      //     numComponents: 3,
      //   },
    });

    // 设置混合模式
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const textureWidth = 512;
    const textureHeight = 512;
    const vertexCounts = textureWidth * textureHeight;
    const vertices = [];
    for (let i = 0; i < vertexCounts; i++) {
      vertices.push(i);
    }
    const vertexBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      index: {
        data: vertices,
        numComponents: 1,
      },
    });

    // 创建两个帧缓存
    let backBuffer = createFrameBuffer(
      gl,
      textureWidth,
      textureHeight,
      gl.FLOAT
    );
    let frontBuffer = createFrameBuffer(
      gl,
      textureWidth,
      textureHeight,
      gl.FLOAT
    );

    // 初始化backBuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, backBuffer.fb);
    gl.viewport(0, 0, backBuffer.width, backBuffer.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(defaultProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, defaultProgramInfo, planeBufferInfo);
    twgl.setUniforms(defaultProgramInfo, {
      resolution: [textureWidth, textureHeight],
    });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, position.length / 3);
    // twgl.drawBufferInfo(gl, planeBufferInfo, gl.TRIANGLE_STRIP);
    let velocity = 0.0;
    let count = 0;
    function render(time: number) {
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, frontBuffer.fb);
      gl.viewport(0, 0, frontBuffer.width, frontBuffer.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(velocityProgramInfo.program);
      //   gl.bindTexture(gl.TEXTURE_2D, backBuffer.fTexture);
      twgl.setBuffersAndAttributes(gl, velocityProgramInfo, planeBufferInfo);
      twgl.setUniforms(velocityProgramInfo, {
        resolution: [textureWidth, textureHeight],
        mouse: mouseInfo.current.mouse,
        mouseFlag: mouseInfo.current.mouseFlag,
        velocity,
        u_texture: backBuffer.fTexture,
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, position.length / 3);
      //   twgl.drawBufferInfo(gl, planeBufferInfo, gl.TRIANGLE_STRIP);
      const ambientColor = hsva(++count % 360, 1.0, 0.8, 1.0);
      gl.enable(gl.BLEND);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pointProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, pointProgramInfo, vertexBufferInfo);
      twgl.setUniforms(pointProgramInfo, {
        ambientColor,
        resolution: [textureWidth, textureHeight],
        pointScale: velocity,
        u_texture: frontBuffer.fTexture,
      });
      gl.drawArrays(gl.POINTS, 0, vertices.length);
      //   twgl.drawBufferInfo(gl, vertexBufferInfo, gl.POINTS);

      gl.flush();

      if (mouseInfo.current.mouseFlag) {
        velocity = 1.0;
      } else {
        velocity *= 0.95;
      }

      let tempBuffer = backBuffer;
      backBuffer = frontBuffer;
      frontBuffer = tempBuffer;
      if (mouseInfo.current.run) {
        requestAnimationFrame(render);
      }
    }
    requestAnimationFrame(render);
  }, []);

  const handleKeyDown = (evt: React.KeyboardEvent<HTMLCanvasElement>) => {
    mouseInfo.current.run = evt.keyCode !== 27;
  };

  const handleMouseDown = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    mouseInfo.current.mouseFlag = true;
  };
  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const cw = cavElem.width;
    const ch = cavElem.height;
    mouseInfo.current.mouse = [
      ((evt.clientX - cavElem.offsetLeft - cw / 2.0) / cw) * 2.0,
      (-(evt.clientY - cavElem.offsetTop - ch / 2.0) / ch) * 2.0,
    ];
  };

  const handleMouseUp = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    mouseInfo.current.mouseFlag = false;
  };

  return (
    <div>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <script type="notjs" id={DEFAULT_VERTEX_ID}>
        {defaultVertexStr}
      </script>
      <script type="notjs" id={DEFAULT_FRAGMENT_ID}>
        {defaultFragmentStr}
      </script>
      <script type="notjs" id={VELOCITY_VERTEX_ID}>
        {velocityVertexStr}
      </script>
      <script type="notjs" id={VELOCITY_FRAGMENT_ID}>
        {velocityFragmentStr}
      </script>
      <script type="notjs" id={POINT_VERTEX_ID}>
        {pointVertexStr}
      </script>
      <script type="notjs" id={POINT_FRAGMENT_ID}>
        {pointFragmentStr}
      </script>
    </div>
  );
}
