import React, { useEffect, useState, useRef, useCallback } from "react";
import * as twgl from "twgl.js";

const { m4, primitives } = twgl;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;

const UPDATE_VERTEX_ID = "update_vertex-id";
const UPDATE_FRAGMENT_ID = "update_fragment_id";

const updateVertexStr = `
    attribute vec4 position;

    void main() {
        gl_Position = position;
    }
`;
const updateFragmentStr = `
    precision highp float;

    uniform sampler2D positionTex;
    uniform sampler2D velocityTex;
    uniform vec2 texDimensions;
    uniform vec2 canvasDimensions;
    uniform float deltaTime;

    vec2 enclideanModulo(vec2 n, vec2 m){
        return mod(mod(n, m)+m, m);
    }

    void main() {
        vec2 texcoord = gl_FragCoord.xy / texDimensions;
        vec2 position = texture2D(positionTex, texcoord).xy;
        vec2 velocity = texture2D(velocityTex, texcoord).xy;

        vec2 newPosition = enclideanModulo(position + velocity * deltaTime, canvasDimensions);

        gl_FragColor = vec4(newPosition, 0, 1);
    }
`;

const DRAW_VERTEX_ID = "draw_vertex_id";
const DRAW_FRAGMENT_ID = "draw_fragment_id";

const drawVertexStr = `
    attribute float id;

    uniform sampler2D texture;
    uniform vec2 texDimensions;
    uniform mat4 u_matrix;

    vec4 getValueFrom2DTextureAs1DArray(sampler2D tex, vec2 dimensions, float index){
        float y = floor(index / dimensions.x);
        float x = mod(index, dimensions.x);
        vec2 texcoord = (vec2(x, y) + 0.5) / dimensions;

        return texture2D(tex, texcoord);
    }

    void main() {
        vec4 position = getValueFrom2DTextureAs1DArray(texture, texDimensions, id);
        gl_Position = u_matrix * vec4(position.xy, 0, 1);
        gl_PointSize = 10.0;
    }
`;

const drawFragmentStr = `
    precision highp float;

    void main() {
        gl_FragColor = vec4(1, 0, 0, 1);
    }
`;
console.log(1111);
export default function GPGPU() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  const createTexture = useCallback(
    (
      gl: WebGLRenderingContext,
      data: Float32Array | null,
      width: number,
      height: number
    ) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        data
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      return texture;
    },
    []
  );
  const createFramebuffer = useCallback(
    (gl: WebGLRenderingContext, tex: WebGLTexture) => {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0
      );

      return fb;
    },
    []
  );

  const rangeRandom = (min: number, max?: number) =>
    min + Math.random() * ((max || min) - min);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    const ext1 = gl.getExtension("OES_texture_float");
    if (!ext1) return;
    const ext2 = gl.getExtension("WEBGL_color_buffer_float");
    if (!ext2) return;
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) return;
    const updateProgramInfo = twgl.createProgramInfo(gl, [
      UPDATE_VERTEX_ID,
      UPDATE_FRAGMENT_ID,
    ]);
    const drawProgramInfo = twgl.createProgramInfo(gl, [
      DRAW_VERTEX_ID,
      DRAW_FRAGMENT_ID,
    ]);

    const rectangleBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
        numComponents: 2,
      },
      indices: {
        numComponents: 3,
        data: [0, 1, 2, 3, 4, 5],
      },
    });
    const particleTexWidth = 20;
    const particleTexHeight = 10;
    const numParticles = particleTexWidth * particleTexHeight;
    const ids = new Array(numParticles).fill(0).map((_, i) => i);
    const pointBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      id: {
        data: ids,
        numComponents: 1,
      },
    });

    const positions = new Float32Array(
      new Array(numParticles)
        .fill(0)
        .map((_, i) => [
          rangeRandom(cavElem.width),
          rangeRandom(cavElem.height),
          0,
          0,
        ])
        .flat()
    );
    const velocities = new Float32Array(
      new Array(numParticles)
        .fill(0)
        .map((_, i) => [rangeRandom(-300, 300), rangeRandom(-300, 300), 0, 0])
        .flat()
    );

    const positionTex = createTexture(
      gl,
      positions,
      particleTexWidth,
      particleTexHeight
    ) as WebGLTexture;
    const velocityTex = createTexture(
      gl,
      velocities,
      particleTexWidth,
      particleTexHeight
    ) as WebGLTexture;

    const backupPositionTex = createTexture(
      gl,
      null,
      particleTexWidth,
      particleTexHeight
    ) as WebGLTexture;

    const updateFB = createFramebuffer(gl, positionTex);
    const drawFB = createFramebuffer(gl, backupPositionTex);

    let oldFrameInfo = {
      fb: updateFB,
      tex: positionTex,
    };

    let newFrameInfo = {
      fb: drawFB,
      tex: backupPositionTex,
    };

    let then = 0;
    function drawScene(time: number) {
      time *= 0.001;
      const deltaTime = time - then;
      then = time;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.bindFramebuffer(gl.FRAMEBUFFER, newFrameInfo.fb);
      gl.viewport(0, 0, particleTexWidth, particleTexHeight);
      gl.useProgram(updateProgramInfo.program);
      twgl.setUniforms(updateProgramInfo, {
        positionTex: oldFrameInfo.tex,
        velocityTex: velocityTex,
        texDimensions: [particleTexWidth, particleTexHeight],
        canvasDimensions: [cavElem.width, cavElem.height],
        deltaTime: deltaTime,
      });
      twgl.setBuffersAndAttributes(gl, updateProgramInfo, rectangleBufferInfo);
      twgl.drawBufferInfo(gl, rectangleBufferInfo);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.viewport(0, 0, cavElem.width, cavElem.height);
      gl.useProgram(drawProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, drawProgramInfo, pointBufferInfo);
      twgl.setUniforms(drawProgramInfo, {
        texDimensions: [particleTexWidth, particleTexHeight],
        u_matrix: m4.ortho(0, gl.canvas.width, 0, gl.canvas.height, -1, 1),
        texture: newFrameInfo.tex,
      });
      twgl.drawBufferInfo(gl, pointBufferInfo, gl.POINTS);
      let tempInfo = oldFrameInfo;
      oldFrameInfo = newFrameInfo;
      newFrameInfo = tempInfo;

      requestAnimationFrame(drawScene);
    }

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <script id={UPDATE_VERTEX_ID} type="notjs">
        {updateVertexStr}
      </script>
      <script id={UPDATE_FRAGMENT_ID} type="notjs">
        {updateFragmentStr}
      </script>
      <script id={DRAW_VERTEX_ID} type="notjs">
        {drawVertexStr}
      </script>
      <script id={DRAW_FRAGMENT_ID} type="notjs">
        {drawFragmentStr}
      </script>
    </div>
  );
}
