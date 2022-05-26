import React, { useRef, useEffect } from "react";
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

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 1024;

const PREVIEW_VERTEX_ID = "preview-vertex-id";
const PREVIEW_FRAGMENT_ID = "preview-fragment-id";

const previewVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mvpMatrix;
    uniform vec4 ambient;

    varying vec4 vColor;
    varying float vDepth;
    varying vec3 vNormal;
    
    void main() {
        gl_Position = mvpMatrix * vec4(position, 1.0);
        vColor = color * ambient;
        vNormal = normal;
        vDepth = gl_Position.z / gl_Position.w;
    }
`;

const previewFragmentStr = `
    #extension GL_EXT_draw_buffers : require
    precision mediump float;

    varying vec4 vColor;
    varying float vDepth;
    varying vec3 vNormal;

    void main() {
        gl_FragData[0] = vColor;
        gl_FragData[1] = vec4(vec3((vDepth + 1.0) / 2.0), 1.0);
        gl_FragData[2] = vec4((vNormal + 1.0) / 2.0, 1.0);
    }
`;

const EDGE_VERTEX_ID = "edge-vertex-id";
const EDGE_FRAGMENT_ID = "edge-fragment-id";

const edgeVertexStr = `
    attribute vec3 position;
    attribute vec2 texCoord;

    varying  vec2 vTexCoord;

    void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position, 1.0);
    }
`;
const edgeFragmentStr = `
    precision mediump float;

    uniform vec2 resolution;
    uniform float weight[9];
    uniform vec2 offsetTexCoord[9];
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;
    uniform sampler2D normalTexture;

    varying vec2 vTexCoord;

    void main() {
        vec2 offsetScale = 1.0 / resolution;
        vec4 destColor = texture2D(colorTexture, vTexCoord);
        vec3 normalColor = vec3(0.0);
        float depthEdge = 0.0;
        for(int i=0; i < 9; ++i){
            vec2 curTexCoord = vTexCoord + offsetTexCoord[i] * offsetScale;
            depthEdge += texture2D(depthTexture, curTexCoord).r * weight[i];
            normalColor += texture2D(normalTexture, curTexCoord).rgb * weight[i];
        }
        float normalEdge = dot(abs(normalColor), vec3(1.0)) / 3.0;
        if(depthEdge > 0.02){
            depthEdge = 1.0;
        } else{
            depthEdge = 0.0;
        }
        float factor = (1.0 - depthEdge) * (1.0 - normalEdge);
        gl_FragColor = vec4(destColor.rgb * factor, destColor.a);
    }
`;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;
    attribute vec2 texCoord;

    uniform vec3 offset;
    
    varying  vec2 vTexCoord;

    void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position * 0.25 + offset, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    uniform sampler2D texture;
    varying vec2 vTexCoord;

    void main() {
        gl_FragColor = texture2D(texture, vTexCoord);
    }
`;

function createFramebufferMRT(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  format?: number
) {
  format = format || gl.UNSIGNED_BYTE;
  const ext = gl.getExtension("WEBGL_draw_buffers") as WEBGL_draw_buffers;
  const frameBuffer = gl.createFramebuffer();

  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  var fTexture = [];

  for (var i = 0; i < 3; ++i) {
    fTexture[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fTexture[i]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      format,
      null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      ext.COLOR_ATTACHMENT0_WEBGL + i,
      gl.TEXTURE_2D,
      fTexture[i],
      0
    );
  }

  var depthRenderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    depthRenderBuffer
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    f: frameBuffer,
    d: depthRenderBuffer,
    t: fTexture,
    width,
    height,
  };
}

export default function EdgeLine() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const qmtRef = useRef<{ q: qtnIV | null; qt: any }>({ q: null, qt: null });

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const mrt_status = {
      color_attachments: 0,
      draw_buffers: 0,
    };
    const ext = gl.getExtension("WEBGL_draw_buffers");
    if (!ext) {
      alert("WEBGL_draw_buffers not supported");
      return;
    } else {
      mrt_status.color_attachments = gl.getParameter(
        ext.MAX_COLOR_ATTACHMENTS_WEBGL
      );
      mrt_status.draw_buffers = gl.getParameter(ext.MAX_DRAW_BUFFERS_WEBGL);
      console.log(
        "MAX_COLOR_ATTACHMENTS_WEBGL: " + mrt_status.color_attachments
      );
      console.log("MAX_DRAW_BUFFERS_WEBGL: " + mrt_status.draw_buffers);
    }
    const previewProgram = twgl.createProgramInfo(gl, [
      PREVIEW_VERTEX_ID,
      PREVIEW_FRAGMENT_ID,
    ]);
    const edgeProgram = twgl.createProgramInfo(gl, [
      EDGE_VERTEX_ID,
      EDGE_FRAGMENT_ID,
    ]);
    const defaultProgram = twgl.createProgramInfo(gl, [
      DEFAULT_VERTEX_ID,
      DEFAULT_FRAGMENT_ID,
    ]);
    // 初始化模型数据
    const cubeData = cube(1.0, [1.0, 1.0, 1.0, 1.0]);
    const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: cubeData.p,
        numComponents: 3,
      },
      texCoord: {
        data: cubeData.t,
        numComponents: 2,
      },
      indices: {
        data: cubeData.i,
        numComponents: 3,
      },
      normal: {
        data: cubeData.n,
        numComponents: 3,
      },
      color: {
        data: cubeData.c,
        numComponents: 4,
      },
    });
    const offsetCoord = [
      -1.0, -1.0, -1.0, 0.0, -1.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0,
      -1.0, 1.0, 0.0, 1.0, 1.0,
    ];
    const weight = [-1.0, -1.0, -1.0, -1.0, 8.0, -1.0, -1.0, -1.0, -1.0];

    const offsets = [
      [-0.75, -0.75, 0.0],
      [-0.25, -0.75, 0.0],
      [0.25, -0.75, 0.0],
    ];
    const position = [
      -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0,
    ];
    const texCoord = [0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0];
    const index = [0, 2, 1, 2, 3, 1];

    const planeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 3,
      },
      texCoord: {
        data: texCoord,
        numComponents: 2,
      },
      indices: {
        data: index,
        numComponents: 3,
      },
    });

    const q = new qtnIV();
    const qt = q.identity(q.create());
    qmtRef.current = {
      q,
      qt,
    };
    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());

    const CUBE_COUNT = 100;
    const cubeOffset: number[][] = [];
    const cubeScale: number[] = [];
    for (let i = 0; i < CUBE_COUNT; ++i) {
      cubeOffset.push([
        Math.random() * 20.0 - 10.0,
        Math.random() * 20.0 - 10.0,
        Math.random() * 20.0 - 10.0,
      ]);
      cubeScale.push(Math.random() + 0.5);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);

    const fBufferWidth = 1024;
    const fBuffer = createFramebufferMRT(gl, fBufferWidth, fBufferWidth);

    for (let i = 0; i < fBuffer.t.length; ++i) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, fBuffer.t[i]);
    }

    const bufferList = [
      ext.COLOR_ATTACHMENT0_WEBGL,
      ext.COLOR_ATTACHMENT1_WEBGL,
      ext.COLOR_ATTACHMENT2_WEBGL,
    ];
    let count = 0;
    function render(time: number) {
      const rad = ((++count % 360) * Math.PI) / 180;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fBuffer.f);
      ext?.drawBuffersWEBGL(bufferList);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(previewProgram.program);

      const eyePosition = [0.0, 0.0, 25.0];
      const camUpPosition = [0.0, 1.0, 0.0];
      q.toVecIII([0.0, 0.0, 35.0], qt, eyePosition);
      q.toVecIII([0.0, 1.0, 0.0], qt, camUpPosition);
      m.lookAt(eyePosition, [0, 0, 0], camUpPosition, vMatrix);
      m.perspective(
        60,
        gl.canvas.width / gl.canvas.height,
        1.0,
        100.0,
        pMatrix
      );
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      twgl.setBuffersAndAttributes(gl, previewProgram, cubeBufferInfo);
      for (let i = 0; i < CUBE_COUNT; ++i) {
        const ambient = hsva(i * (360 / CUBE_COUNT), 1.0, 1.0, 1.0);
        m.identity(mMatrix);
        m.rotate(mMatrix, rad, [0.0, 1.0, 0.0], mMatrix);
        m.translate(mMatrix, cubeOffset[i], mMatrix);
        m.scale(mMatrix, [cubeScale[i], cubeScale[i], cubeScale[i]], mMatrix);
        m.multiply(tmpMatrix, mMatrix, mvpMatrix);
        twgl.setUniforms(previewProgram, {
          ambient,
          mvpMatrix,
        });
        twgl.drawBufferInfo(gl, cubeBufferInfo);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(edgeProgram.program);

      twgl.setBuffersAndAttributes(gl, edgeProgram, planeBufferInfo);
      twgl.setUniforms(edgeProgram, {
        resolution: [gl.canvas.width, gl.canvas.height],
        weight,
        offsetTexCoord: offsetCoord,
      });
      twgl.drawBufferInfo(gl, planeBufferInfo);

      gl.useProgram(defaultProgram.program);

      twgl.setBuffersAndAttributes(gl, defaultProgram, planeBufferInfo);
      for (let i = 0; i < 3; ++i) {
        twgl.setUniforms(defaultProgram, {
          offset: offsets[i],
          texture: fBuffer.t[i],
        });
        twgl.drawBufferInfo(gl, planeBufferInfo);
      }

      gl.flush();

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const { q, qt } = qmtRef.current;
    if (q) {
      const c = cavRef.current as HTMLCanvasElement;
      var cw = c.width;
      var ch = c.height;
      var wh = 1 / Math.sqrt(cw * cw + ch * ch);
      var x = evt.clientX - c.offsetLeft - cw * 0.5;
      var y = evt.clientY - c.offsetTop - ch * 0.5;
      var sq = Math.sqrt(x * x + y * y);
      var r = sq * 2.0 * Math.PI * wh;
      if (sq != 1) {
        sq = 1 / sq;
        x *= sq;
        y *= sq;
      }
      q.rotate(r, [y, x, 0.0], qt);
    }
  };

  return (
    <div>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
      />
      <script type="notjs" id={PREVIEW_VERTEX_ID}>
        {previewVertexStr}
      </script>
      <script type="notjs" id={PREVIEW_FRAGMENT_ID}>
        {previewFragmentStr}
      </script>
      <script type="notjs" id={EDGE_VERTEX_ID}>
        {edgeVertexStr}
      </script>
      <script type="notjs" id={EDGE_FRAGMENT_ID}>
        {edgeFragmentStr}
      </script>
      <script type="notjs" id={DEFAULT_VERTEX_ID}>
        {defaultVertexStr}
      </script>
      <script type="notjs" id={DEFAULT_FRAGMENT_ID}>
        {defaultFragmentStr}
      </script>
    </div>
  );
}
