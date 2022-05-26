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

const PREVIEW_VERTEX_ID = "preview-vetex-id";
const PREVIEW_FRAGMENT_ID = "preview-fragment-id";

const previewVertexStr = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec4 color;

    uniform mat4 mvpMatrix;
    uniform mat4 invMatrix;
    uniform vec4 ambient;
    uniform vec3 lightDirection;

    varying vec4 vDest;
    varying vec4 vColor;
    varying float vDepth;
    varying vec3 vNormal;

    void main() {
        gl_Position = mvpMatrix * vec4(position, 1.0);
        vec3 invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
        float diff = clamp(dot(normal, invLight), 0.0, 1.0);
        vDest = vec4(color.rgb * ambient.rgb * diff, 1.0);
        vColor = color * ambient;
        vDepth = gl_Position.z / gl_Position.w;
    }
`;
const previewFragmentStr = `
    #extension GL_EXT_draw_buffers : require

    precision mediump float;

    varying vec4 vDest;
    varying vec4 vColor;
    varying float vDepth;
    varying vec3 vNormal;

    void main(){
        gl_FragData[0] = vDest;
        gl_FragData[1] = vColor;
        gl_FragData[2] = vec4((vNormal + 1.0) / 2.0, 1.0);
        gl_FragData[3] = vec4(vec3((vDepth + 1.0) / 2.0), 1.0);
    }
`;

const DEFAULT_VERTEX_ID = "default-vertex-id";
const DEFAULT_FRAGMENT_ID = "default-fragment-id";

const defaultVertexStr = `
    attribute vec3 position;
    attribute vec2 texCoord;
    
    uniform vec3 offset;

    varying vec2 vTexCoord;

    void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position + offset, 1.0);
    }
`;
const defaultFragmentStr = `
    precision mediump float;

    uniform sampler2D texture;
    varying vec2 vTexCoord;

    void main(){
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

  for (var i = 0; i < 4; ++i) {
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

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 1024;

export default function MRT() {
  const qmtRef = useRef<{ q: qtnIV | null; qt: any }>({ q: null, qt: null });
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    const ext = gl.getExtension("WEBGL_draw_buffers");
    let mrt_status = {
      color_attachments: 0,
      draw_buffers: 0,
    };
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
    const defaultProgramInfo = twgl.createProgramInfo(gl, [
      DEFAULT_VERTEX_ID,
      DEFAULT_FRAGMENT_ID,
    ]);
    const previewProgramInfo = twgl.createProgramInfo(gl, [
      PREVIEW_VERTEX_ID,
      PREVIEW_FRAGMENT_ID,
    ]);
    const offsets = [
      [-0.5, -0.5, 0.0],
      [-0.5, 0.5, 0.0],
      [0.5, -0.5, 0.0],
      [0.5, 0.5, 0.0],
    ];
    const position = [
      -0.5, 0.5, 0.0, 0.5, 0.5, 0.0, -0.5, -0.5, 0.0, 0.5, -0.5, 0.0,
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

    const torusData = torus(64, 64, 1.0, 2.0, [1.0, 1.0, 1.0, 1.0]);
    const torusBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: torusData.p,
        numComponents: 3,
      },
      texCoord: {
        data: torusData.t,
        numComponents: 2,
      },
      indices: {
        data: torusData.i,
        numComponents: 3,
      },
      normal: {
        data: torusData.n,
        numComponents: 3,
      },
      color: {
        data: torusData.c,
        numComponents: 4,
      },
    });
    const m = new matIV();
    const mMatrix = m.identity(m.create());
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    const tmpMatrix = m.identity(m.create());
    const mvpMatrix = m.identity(m.create());
    const invMatrix = m.identity(m.create());

    const q = new qtnIV();
    const qt = q.identity(q.create());
    qmtRef.current = {
      q,
      qt,
    };
    const textureWidth = 512;
    const textureHeight = 512;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    const fbuffer = createFramebufferMRT(gl, textureWidth, textureHeight);
    for (let i = 0; i < fbuffer.t.length; ++i) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, fbuffer.t[i]);
    }
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);

    const lightDirection = [-0.577, 0.577, 0.577];
    const eyePosition = [0.0, 20.0, 0.0];
    const camUpDirection = [0.0, 0.0, -1.0];
    const bufferList = [
      ext.COLOR_ATTACHMENT0_WEBGL,
      ext.COLOR_ATTACHMENT1_WEBGL,
      ext.COLOR_ATTACHMENT2_WEBGL,
      ext.COLOR_ATTACHMENT3_WEBGL,
    ];
    let count = 0;
    function render(time: number) {
      const rad = ((++count % 360) * Math.PI) / 180;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbuffer.f);
      ext?.drawBuffersWEBGL(bufferList);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.viewport(0, 0, fbuffer.width, fbuffer.height);

      gl.useProgram(previewProgramInfo.program);

      q.toVecIII([0.0, 20.0, 0.0], qt, eyePosition);
      q.toVecIII([0.0, 0.0, -1.0], qt, camUpDirection);
      m.lookAt(eyePosition, [0, 0, 0], camUpDirection, vMatrix);
      m.perspective(75, fbuffer.width / fbuffer.height, 0.1, 100.0, pMatrix);
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      twgl.setBuffersAndAttributes(gl, previewProgramInfo, torusBufferInfo);
      for (let i = 0; i < 9; ++i) {
        const ambient = hsva(i * 40, 1.0, 1.0, 1.0);
        m.identity(mMatrix);
        m.rotate(mMatrix, (i * 2 * Math.PI) / 9, [0, 1, 0], mMatrix);
        m.translate(mMatrix, [0.0, 0.0, 10.0], mMatrix);
        m.rotate(mMatrix, rad, [1, 1, 0], mMatrix);
        m.inverse(mMatrix, invMatrix);
        m.multiply(tmpMatrix, mMatrix, mvpMatrix);
        twgl.setUniforms(previewProgramInfo, {
          mvpMatrix,
          invMatrix,
          ambient,
          lightDirection,
        });
        twgl.drawBufferInfo(gl, torusBufferInfo);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(defaultProgramInfo.program);

      twgl.setBuffersAndAttributes(gl, defaultProgramInfo, planeBufferInfo);
      for (let i = 0; i < 4; ++i) {
        twgl.setUniforms(defaultProgramInfo, {
          offset: offsets[i],
          texture: fbuffer.t[i],
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
      <script type="notjs" id={DEFAULT_VERTEX_ID}>
        {defaultVertexStr}
      </script>
      <script type="notjs" id={DEFAULT_FRAGMENT_ID}>
        {defaultFragmentStr}
      </script>
    </div>
  );
}
