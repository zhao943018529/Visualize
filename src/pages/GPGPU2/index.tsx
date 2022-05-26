import { height, width } from "@mui/system";
import React, { useRef, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 760;

const closetLineVS = `
    attribute vec4 position;

    void main() {
        gl_Position = position;
    }
`;

const updatePositionFS = `
    precision highp float;

    uniform float u_deltaTime;
    uniform sampler2D u_velocityTex;
    uniform sampler2D u_positionTex;
    uniform vec2 canvasDimensions;
    uniform vec2 texDimensions;

    vec2 euclideanModulo(vec2 n, vec2 m){
        return mod(mod(n, m) + m, m);
    }

    void main() {
        vec2 texcoord = gl_FragCoord.xy / texDimensions;

        vec2 position = texture2D(u_positionTex, texcoord).xy;
        vec2 velocity = texture2D(u_velocityTex, texcoord).xy;
        vec2 newPosition = euclideanModulo(position + velocity * u_deltaTime, canvasDimensions);

        gl_FragColor = vec4(newPosition, 0, 1);
    }
`;

function getClosetLineFS(numLineSegments: number) {
  return `
    precision highp float;

    uniform float numPoints;
    uniform sampler2D u_pointsTex;
    uniform sampler2D u_linesTex;
    uniform vec2 u_pointDimensions;
    uniform vec2 u_lineDimensions;


    vec4 getAs1D(sampler2D tex, vec2 dimensions,float index){
        float y = floor(index / dimensions.x);
        float x = mod(index, dimensions.x);
        vec2 texcoord= (vec2(x, y) + 0.5) / dimensions;

        return texture2D(tex, texcoord);
    }
      
    // from https://stackoverflow.com/a/6853926/128511
    // a is the point, b,c is the line segment
    float distanceFromPointToLine(in vec3 a, in vec3 b, in vec3 c) {
        vec3 ba = a - b;
        vec3 bc = c - b;
        float d = dot(ba, bc);
        float len = length(bc);
        float param = 0.0;
        if (len != 0.0) {
            param = clamp(d / (len * len), 0.0, 1.0);
        }
        vec3 r = b + bc * param;
        return distance(a, r);
    }

    void main() {

        float ndx = floor(gl_FragCoord.y) * u_pointDimensions.x + floor(gl_FragCoord.x);
        float minDist = 10000000.00;
        float minIndex = -1.0;

        vec3 pointPosition = getAs1D(u_pointsTex, u_pointDimensions, ndx).xyz;
        for(int j=0; j< ${numLineSegments}; ++j){
            vec3 lineStartPosition = getAs1D(u_linesTex, u_lineDimensions, float(j * 2)).xyz;
            vec3 lineEndPosition = getAs1D(u_linesTex, u_lineDimensions, float(j * 2 + 1)).xyz;
            float dist = distanceFromPointToLine(pointPosition, lineStartPosition, lineEndPosition);
            if(dist < minDist){
                minDist = dist;
                minIndex = float(j);
            }
        }

        gl_FragColor = vec4(
            mod(minIndex, 256.0),
            mod(minIndex / 256.0, 256.0),
            mod(minIndex / (256.0 * 256.0), 256.0),
            floor(minIndex / (256.0 * 256.0 * 256.0))
        ) / 255.0;
    }
`;
}

const drawLineVS = `
    attribute float id;

    uniform sampler2D linesTex;
    uniform vec2 texDimensions;
    uniform mat4 u_matrix;

    vec4 getAs1D(sampler2D tex, vec2 dimensions,float index){
        float y = floor(index / dimensions.x);
        float x = mod(index, dimensions.x);
        vec2 texcoord= (vec2(x, y) + 0.5) / dimensions;

        return texture2D(tex, texcoord);
    }

    void main() {
        vec4 position = getAs1D(linesTex, texDimensions, id);
        gl_Position = u_matrix * vec4(position.xy, 0, 1);
    }
`;

const drawLineFS = `
    precision highp float;

    void main() {
        gl_FragColor = vec4(vec3(0.8), 1);
    }
`;

const drawClosetLineVS = `
    attribute float id;
    
    uniform sampler2D u_closetTex;
    uniform vec2 closetDimensions;
    uniform sampler2D u_positionTex;
    uniform vec2 texDimensions;
    uniform mat4 u_matrix;
    uniform float numPoints;

    varying vec4 v_color;

    vec3 hsv2rgb(vec3 c) {
        c = vec3(c.x, clamp(c.yz, 0.0, 1.0));
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec4 getAs1D(sampler2D tex, vec2 dimensions,float index){
        float y = floor(index / dimensions.x);
        float x = mod(index, dimensions.x);
        vec2 texcoord= (vec2(x, y) + 0.5) / dimensions;

        return texture2D(tex, texcoord);
    }

    void main() {
        float pointId = floor(id / 2.0);
        vec4 lineCode = getAs1D(u_closetTex, closetDimensions, pointId);
        float lineId = dot(lineCode, vec4(255, 255 * 256, 256 * 256 * 255, 256 * 256 * 256 *255));
        float linePointId = lineId * 2.0 + mod(id, 2.0);
        vec4 position = getAs1D(u_positionTex, texDimensions, linePointId);

        gl_Position = u_matrix * vec4(position.xy, 0, 1);
        gl_PointSize = 5.0;
        float hue = pointId / numPoints;
        v_color = vec4(hsv2rgb(vec3(hue, 1, 1)), 1);
    }
`;

const drawPointsVS = `
    attribute float id;

    uniform sampler2D u_pointsTex;
    uniform vec2 texDimensions;
    uniform mat4 u_matrix;
    uniform float numPoints;

    varying vec4 v_color;

    vec3 hsv2rgb(vec3 c) {
        c = vec3(c.x, clamp(c.yz, 0.0, 1.0));
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec4 getAs1D(sampler2D tex, vec2 dimensions,float index){
        float y = floor(index / dimensions.x);
        float x = mod(index, dimensions.x);
        vec2 texcoord= (vec2(x, y) + 0.5) / dimensions;

        return texture2D(tex, texcoord);
    }

    void main() {
        vec4 position = getAs1D(u_pointsTex, texDimensions, id);
        gl_Position = u_matrix * vec4(position.xy, 0, 1);
        
        gl_PointSize = 5.0;
        float hue = id / numPoints;
        v_color = vec4(hsv2rgb(vec3(hue, 1, 1)), 1);
    }
`;

const drawClosetLineFS = `
    precision highp float;

    varying vec4 v_color;

    void main() {
        gl_FragColor = v_color;
    }
`;

const RECTANGLE_VERTEX = "rectangle-vertex";
const LINE_VERTEX = "line-vertex";
const UPDATE_FRAGMENT = "update-fragment";
const CLOSET_TEX_FRAGMENT = "closet-tex-fragment";
const DRAW_LINE_FRAGMENT = "draw-line-fragment";
const CLOSET_LINE_VERTEX = "closet-line-vertex";
const CLOSET_POINT_VERTEX = "closet-point-vertex";
const CLOSET_LINE_POINT_FRAGMENT = "closet-line-point-fragment";

/**
 *
 * @returns
 *
 *  1.先根据速度和位置计算出点和线的最新位置到它们的texture
 *  2.根据最新位置计算出closetLineTexture
 *  3.渲染所有的线
 *  4.根据closetLineTexture能够找到对应的最近的线的位置根据point_id生成对应的颜色然后渲染
 *
 *
 */

const r = (min: number, max: number) => min + Math.random() * (max - min);

function createPoints(numPoints: number, ranges: number[][]) {
  const points = [];
  for (let i = 0; i < numPoints; ++i) {
    points.push(...ranges.map((range) => r(range[0], range[1])), 0, 0); // RGBA
  }
  return points;
}

function createTexture(
  gl: WebGLRenderingContext,
  data: number[],
  type: number
) {
  const numElements = data.length / 4;
  const width = Math.ceil(Math.sqrt(numElements));
  const height = Math.ceil(numElements / width);
  const bin =
    type === gl.FLOAT
      ? new Float32Array(width * height * 4)
      : new Uint8Array(width * height * 4);
  bin.set(data);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    type,
    bin
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { tex, dimensions: [width, height] };
}

function createFramebuffer(gl: WebGLRenderingContext, tex: WebGLTexture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0
  );

  return framebuffer;
}

export default function GPGPU2() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const segmentsRef = useRef<number>(125);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    // check we can use floating point textures
    const ext1 = gl.getExtension("OES_texture_float");
    if (!ext1) {
      alert("Need OES_texture_float");
      return;
    }
    // check we can render to floating point textures
    const ext2 = gl.getExtension("WEBGL_color_buffer_float");
    if (!ext2) {
      alert("Need WEBGL_color_buffer_float");
      return;
    }
    // check we can use textures in a vertex shader
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 2) {
      alert("Can not use textures in vertex shaders");
      return;
    }

    const updatePointProgramInfo = twgl.createProgramInfo(gl, [
      RECTANGLE_VERTEX,
      UPDATE_FRAGMENT,
    ]);
    const closetTextureProgramInfo = twgl.createProgramInfo(gl, [
      RECTANGLE_VERTEX,
      CLOSET_TEX_FRAGMENT,
    ]);
    const drawAllLineProgramInfo = twgl.createProgramInfo(gl, [
      LINE_VERTEX,
      DRAW_LINE_FRAGMENT,
    ]);
    const drawPointProgramInfo = twgl.createProgramInfo(gl, [
      CLOSET_POINT_VERTEX,
      CLOSET_LINE_POINT_FRAGMENT,
    ]);
    const drawLineProgramInfo = twgl.createProgramInfo(gl, [
      CLOSET_LINE_VERTEX,
      CLOSET_LINE_POINT_FRAGMENT,
    ]);

    const points = createPoints(8, [
      [0, gl.canvas.width],
      [0, gl.canvas.height],
    ]);
    const lines = createPoints(segmentsRef.current * 2, [
      [0, gl.canvas.width],
      [0, gl.canvas.height],
    ]);

    const numPoints = points.length / 4;
    const numLineSegments = segmentsRef.current;

    const pointVelocities = createPoints(numPoints, [
      [-20, 20],
      [-20, 20],
    ]);
    const lineVelocities = createPoints(numLineSegments * 2, [
      [-20, 20],
      [-20, 20],
    ]);

    const { tex: pointsTex1, dimensions: pointsTexDimensions1 } = createTexture(
      gl,
      points,
      gl.FLOAT
    );
    const { tex: pointsTex2, dimensions: pointsTexDimensions2 } = createTexture(
      gl,
      points,
      gl.FLOAT
    );
    const { tex: linesTex1, dimensions: linesTexDimensions1 } = createTexture(
      gl,
      lines,
      gl.FLOAT
    );
    const { tex: linesTex2, dimensions: linesTexDimensions2 } = createTexture(
      gl,
      lines,
      gl.FLOAT
    );

    const { tex: pointVelocityTex, dimensions: pointVelocityDimensions } =
      createTexture(gl, pointVelocities, gl.FLOAT);
    const { tex: lineVelocityTex, dimensions: lineVelocityDimensions } =
      createTexture(gl, lineVelocities, gl.FLOAT);

    const pointFB1 = createFramebuffer(gl, pointsTex1 as WebGLTexture);
    const pointFB2 = createFramebuffer(gl, pointsTex2 as WebGLTexture);
    const lineFB1 = createFramebuffer(gl, linesTex1 as WebGLTexture);
    const lineFB2 = createFramebuffer(gl, linesTex2 as WebGLTexture);

    let oldFrameInfo = {
      pointFB: pointFB1,
      lineFB: lineFB1,
      pointTex: pointsTex1,
      lineTex: linesTex1,
    };

    let newFrameInfo = {
      pointFB: pointFB2,
      lineFB: lineFB2,
      pointTex: pointsTex2,
      lineTex: linesTex2,
    };

    const quadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        numComponents: 2,
        data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
      },
    });

    const numIds = Math.max(numPoints, numLineSegments * 2);
    const ids = new Array(numIds).fill(0).map((_, i) => i);
    const idBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      id: {
        numComponents: 1,
        data: ids,
      },
    });

    const { tex: closetLinesTex, dimensions: closetLinesTexDimensions } =
      createTexture(gl, new Array(numPoints * 4), gl.UNSIGNED_BYTE);
    const closetLineFB = createFramebuffer(gl, closetLinesTex as WebGLTexture);
    let then = 0;

    function drawScene(time: number) {
      time *= 0.001;
      const deltaTime = time - then;
      then = time;

      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.bindFramebuffer(gl.FRAMEBUFFER, newFrameInfo.pointFB);
      gl.viewport(0, 0, pointsTexDimensions1[0], pointsTexDimensions1[1]);
      gl.useProgram(updatePointProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, updatePointProgramInfo, quadBufferInfo);
      twgl.setUniforms(updatePointProgramInfo, {
        u_positionTex: oldFrameInfo.pointTex,
        u_velocityTex: pointVelocityTex,
        canvasDimensions: [gl.canvas.width, gl.canvas.height],
        texDimensions: pointsTexDimensions1,
        u_deltaTime: deltaTime,
      });
      twgl.drawBufferInfo(gl, quadBufferInfo);

      gl.bindFramebuffer(gl.FRAMEBUFFER, newFrameInfo.lineFB);
      gl.viewport(0, 0, linesTexDimensions1[0], linesTexDimensions1[1]);
      gl.useProgram(updatePointProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, updatePointProgramInfo, quadBufferInfo);
      twgl.setUniforms(updatePointProgramInfo, {
        u_positionTex: oldFrameInfo.lineTex,
        u_velocityTex: lineVelocityTex,
        canvasDimensions: [gl.canvas.width, gl.canvas.height],
        texDimensions: linesTexDimensions1,
        u_deltaTime: deltaTime,
      });
      twgl.drawBufferInfo(gl, quadBufferInfo);

      // 找到与点最近的线的texture
      gl.bindFramebuffer(gl.FRAMEBUFFER, closetLineFB);
      gl.viewport(
        0,
        0,
        closetLinesTexDimensions[0],
        closetLinesTexDimensions[1]
      );
      gl.useProgram(closetTextureProgramInfo.program);
      twgl.setBuffersAndAttributes(
        gl,
        closetTextureProgramInfo,
        quadBufferInfo
      );
      twgl.setUniforms(closetTextureProgramInfo, {
        u_pointsTex: newFrameInfo.pointTex,
        u_linesTex: newFrameInfo.lineTex,
        u_pointDimensions: pointsTexDimensions1,
        u_lineDimensions: linesTexDimensions1,
        numPoints: numPoints,
      });
      twgl.drawBufferInfo(gl, quadBufferInfo);

      const matrix = m4.ortho(0, gl.canvas.width, 0, gl.canvas.height, -1, 1);
      // 利用更新到新的position texture的数据将所有的线画出来
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.useProgram(drawAllLineProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, drawAllLineProgramInfo, idBufferInfo);
      twgl.setUniforms(drawAllLineProgramInfo, {
        linesTex: newFrameInfo.lineTex,
        texDimensions: linesTexDimensions1,
        u_matrix: matrix,
      });
      twgl.drawBufferInfo(gl, idBufferInfo, gl.LINES, segmentsRef.current * 2);

      // 利用closet line texture将与对应点的线画出来
      gl.useProgram(drawLineProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, drawLineProgramInfo, idBufferInfo);
      twgl.setUniforms(drawLineProgramInfo, {
        u_closetTex: closetLinesTex,
        closetDimensions: closetLinesTexDimensions,
        u_positionTex: newFrameInfo.lineTex,
        texDimensions: linesTexDimensions1,
        u_matrix: matrix,
        numPoints: numPoints,
      });
      twgl.drawBufferInfo(gl, idBufferInfo, gl.LINES, numPoints * 2);

      // 将所有的点画出来
      gl.useProgram(drawPointProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, drawPointProgramInfo, idBufferInfo);
      twgl.setUniforms(drawPointProgramInfo, {
        u_pointsTex: newFrameInfo.pointTex,
        texDimensions: pointsTexDimensions1,
        u_matrix: matrix,
        numPoints: numPoints,
      });
      twgl.drawBufferInfo(gl, idBufferInfo, gl.POINTS, numPoints);
      // 交换新旧framebuffer
      let tempFrameInfo = newFrameInfo;
      newFrameInfo = oldFrameInfo;
      oldFrameInfo = tempFrameInfo;

      requestAnimationFrame(drawScene);
    }

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <script id={RECTANGLE_VERTEX} type="notjs">
        {closetLineVS}
      </script>
      <script id={UPDATE_FRAGMENT} type="notjs">
        {updatePositionFS}
      </script>
      <script id={LINE_VERTEX} type="notjs">
        {drawLineVS}
      </script>
      <script id={CLOSET_TEX_FRAGMENT} type="notjs">
        {getClosetLineFS(segmentsRef.current)}
      </script>
      <script id={DRAW_LINE_FRAGMENT} type="notjs">
        {drawLineFS}
      </script>
      <script id={CLOSET_LINE_VERTEX} type="notjs">
        {drawClosetLineVS}
      </script>
      <script id={CLOSET_POINT_VERTEX} type="notjs">
        {drawPointsVS}
      </script>
      <script id={CLOSET_LINE_POINT_FRAGMENT} type="notjs">
        {drawClosetLineFS}
      </script>
      <script id={CLOSET_LINE_VERTEX} type="notjs">
        {drawClosetLineVS}
      </script>
    </div>
  );
}
