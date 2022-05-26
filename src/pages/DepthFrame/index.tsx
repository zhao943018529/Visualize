import React, { useRef, useEffect, useState, useCallback } from "react";
import { Box, Slider } from "@mui/material";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

const { primitives, m4 } = twgl;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec4 position;
    attribute vec2 texcoord;
    attribute vec3 normal;

    uniform mat4 u_world;
    uniform mat4 u_view;
    uniform mat4 u_projection;
    uniform mat4 u_textureMatrix;
    uniform vec3 u_lightPosition;
    uniform vec3 u_eyePosition;

    varying vec4 v_projectedTexcoord;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToEye;
    

    void main(){
        vec4 worldPosition = u_world * position;
        gl_Position = u_projection * u_view * worldPosition;

        v_projectedTexcoord = u_textureMatrix * worldPosition;
        v_texCoord = texcoord;
        v_normal = mat3(u_world) * normal;
        v_surfaceToLight = u_lightPosition - worldPosition.xyz;
        v_surfaceToEye = u_eyePosition - worldPosition.xyz;
    }
`;

const fragmentStr = `
    precision mediump float;

    uniform vec4 u_lightColor;
    uniform sampler2D u_texture;
    uniform sampler2D u_projectedTexture;
    uniform vec4 u_colorMult;
    uniform vec3 u_lightDirection;
    uniform float u_bias;
    uniform float u_limit;
    uniform float u_shininess;
    uniform float u_innerLimit;
    uniform float u_outerLimit;

    varying vec4 v_projectedTexcoord;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToEye;

    void main() {
        vec3 realNormal = normalize(v_normal);
        vec3 surfaceToLight = normalize(v_surfaceToLight);
        vec3 surfaceToEye = normalize(v_surfaceToEye);
        vec3 halfVector = normalize(surfaceToLight + surfaceToEye);
        float dotFromDirection = dot(surfaceToLight, -u_lightDirection);
        float limitRange = u_innerLimit - u_outerLimit;
        float inLight = clamp((dotFromDirection - u_outerLimit) / limitRange , 0.0 , 1.0);

        float light = inLight * dot(halfVector, realNormal);
        float specular = inLight * pow(dot(realNormal, halfVector), u_shininess);
        
        vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
        float currentDepth = projectedTexcoord.z + u_bias;
        float projectedDepth = texture2D(u_projectedTexture, projectedTexcoord.xy).r;

        bool inRange = projectedTexcoord.x >= 0.0 
        && projectedTexcoord.x <= 1.0 
        && projectedTexcoord.y >= 0.0 
        && projectedTexcoord.y <= 1.0;

        vec4 texColor = texture2D(u_texture, v_texCoord);
        float shadowLight = (inRange && projectedDepth <= currentDepth) ? 0.0 : 1.0;
        gl_FragColor = vec4(texColor.rgb * light * shadowLight + specular * shadowLight, texColor.a);
    }
`;

const COLOR_VERTEX_ID = "color-vertex-id";
const COLOR_FRAGMENT_ID = "color-fragment-id";

const colorVertexStr = `
    attribute vec4 position;

    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;

    void main() {
    // Multiply the position by the matrices.
        gl_Position = u_projection * u_view * u_world * position;
    }    
`;
const colorFragmentStr = `
    precision mediump float;

    uniform vec4 u_color;
    void main() {
        gl_FragColor = u_color;
    }
`;

interface ConfigOption {
  fieldOfView: number;
  proWidth: number;
  proHeight: number;
  eyePosition: number[];
  position: number[];
  target: number[];
  lightPosition: number[];
  lightDirection: number[];
}

export default function DepthFrame() {
  const [yAngle, setYAngle] = useState<number>(120);
  const [config, setConfig] = useState<ConfigOption>({
    fieldOfView: 90,
    proWidth: 1,
    proHeight: 1,
    eyePosition: [-6.0, 9.0, 7.0],
    position: [2.5, 5.8, 4.3],
    target: [2.5, 0, 3.5],
    lightPosition: [-8.0, 12, 7.0],
    lightDirection: [0, 0, 1],
  });
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const frameBufferRef = useRef<WebGLFramebuffer>();
  const frameBufferInfoRef = useRef<twgl.FramebufferInfo>();
  const texturesRef = useRef<{ [key: string]: WebGLTexture }>({});
  const programInfoRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const primitiveInfosRef = useRef<{ [key: string]: twgl.BufferInfo }>({});

  const drawScene = useCallback(
    (
      programInfo: twgl.ProgramInfo,
      projectionMatrix: twgl.m4.Mat4,
      cameraMatrix: twgl.m4.Mat4,
      textureMatrix: twgl.m4.Mat4,
      lightWorldMatrix: twgl.m4.Mat4,
      yAngle: number
    ) => {
      const yAngleMatrix = m4.rotationY(deg2radians(yAngle));
      const gl = glRef.current as WebGLRenderingContext;
      const { cubeBufferInfo, sphereBufferInfo, planeBufferInfo } =
        primitiveInfosRef.current;
      const { bgTexture, depthTexture } = texturesRef.current;
      gl.useProgram(programInfo.program);
      const viewMatrix = m4.inverse(cameraMatrix);
      const planeUniforms = {
        u_colorMult: [0.5, 0.5, 1, 1], // lightblue
        u_color: [1, 0, 0, 1],
        u_world: m4.translation([0, 0, 0]),
        u_texture: bgTexture,
        u_limit: deg2radians(10),
        u_shininess: 150,
        u_bias: -0.006,
        u_lightPosition: config.position,
        u_lightDirection: lightWorldMatrix.slice(8, 11).map((v) => -v),
        u_lightColor: [0.2, 1, 0.2, 1],
        u_eyePosition: config.eyePosition,
        u_innerLimit: Math.cos(deg2radians(config.fieldOfView / 2 - 10)),
        u_outerLimit: Math.cos(deg2radians(config.fieldOfView / 2)),
      };
      const sphereUniforms = {
        u_colorMult: [1, 0.5, 0.5, 1], // pink
        u_color: [0, 0, 1, 1],
        u_world: m4.multiply(yAngleMatrix, m4.translation([2, 3, 4])),
        u_texture: bgTexture,
      };
      const cubeUniforms = {
        u_colorMult: [0.5, 1, 0.5, 1], // lightgreen
        u_color: [0, 0, 1, 1],
        u_world: m4.multiply(yAngleMatrix, m4.translation([3, 1, 0])),
        u_texture: bgTexture,
      };
      twgl.setUniforms(programInfo, {
        u_view: viewMatrix,
        u_projection: projectionMatrix,
        u_textureMatrix: textureMatrix,
        // u_colorMult: [1, 0.5, 0.5, 1],
        u_projectedTexture: depthTexture,
        u_bias: -0.006,
      });
      twgl.setUniforms(programInfo, planeUniforms);
      twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
      //   twgl.drawBufferInfo(gl, planeBufferInfo, gl.TRIANGLES);
      gl.drawElements(
        gl.TRIANGLES,
        planeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
      twgl.setUniforms(programInfo, cubeUniforms);
      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
      //   twgl.drawBufferInfo(gl, cubeBufferInfo, gl.TRIANGLES);
      gl.drawElements(
        gl.TRIANGLES,
        cubeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
      twgl.setUniforms(programInfo, sphereUniforms);
      twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
      //   twgl.drawBufferInfo(gl, sphereBufferInfo, gl.TRIANGLES);
      gl.drawElements(
        gl.TRIANGLES,
        sphereBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
    },
    []
  );

  // 绑定frameBuffer
  // 创建当前透视投影矩阵与及纹理矩阵
  // 解绑frameBuffer
  //
  const render = useCallback((info: ConfigOption, yAng: number) => {
    const gl = glRef.current as WebGLRenderingContext;
    const { programInfo, colorProgramInfo } = programInfoRef.current;
    const { depthTexture, bgTexture } = texturesRef.current;
    const frameBufferInfo = frameBufferInfoRef.current as twgl.FramebufferInfo;
    const { cubeLinesBufferInfo } = primitiveInfosRef.current;
    const depthFramebuffer = frameBufferRef.current as WebGLFramebuffer;

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const up = [0, 1, 0];
    let lightWorldMatrix = m4.lookAt(info.position, info.target, up);
    const fieldOfViewRadians = deg2radians(info.fieldOfView);
    let aspect = info.proWidth / info.proHeight;
    let lightProjectionMatrix = m4.perspective(
      fieldOfViewRadians,
      aspect,
      0.5,
      10
    );
    twgl.bindFramebufferInfo(gl, frameBufferInfo);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferInfo);
    // gl.viewport(0, 0, 512, 512);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawScene(
      colorProgramInfo,
      lightProjectionMatrix,
      lightWorldMatrix,
      m4.identity(),
      lightWorldMatrix,
      yAng
    );
    aspect = gl.canvas.width / gl.canvas.height;
    let projectionMatrix = m4.perspective(deg2radians(60), aspect, 1, 2000);
    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, [0.5, 0.5, 0.5]);
    textureMatrix = m4.scale(textureMatrix, [0.5, 0.5, 0.5]);
    const tempMatrix = m4.multiply(
      lightProjectionMatrix,
      m4.inverse(lightWorldMatrix)
    );
    // textureMatrix = m4.multiply(textureMatrix, lightProjectionMatrix);
    textureMatrix = m4.multiply(textureMatrix, tempMatrix);
    let cameraMatrix = m4.lookAt(info.eyePosition, [0, 0, 0], up);
    // let rotationMatrix = m4.rotationY(deg2radians(yAngle));
    // cameraMatrix = m4.multiply(cameraMatrix, rotationMatrix);
    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    drawScene(
      programInfo,
      projectionMatrix,
      cameraMatrix,
      textureMatrix,
      lightWorldMatrix,
      yAng
    );

    const cubeLineMatrix = m4.multiply(
      lightWorldMatrix,
      m4.inverse(lightProjectionMatrix)
    );
    gl.useProgram(colorProgramInfo.program);
    const cubeLineUniforms = {
      u_projection: projectionMatrix,
      u_world: cubeLineMatrix,
      u_view: m4.inverse(cameraMatrix),
      u_color: [0, 0, 0, 1],
    };
    twgl.setUniforms(colorProgramInfo, cubeLineUniforms);
    twgl.setBuffersAndAttributes(gl, colorProgramInfo, cubeLinesBufferInfo);
    twgl.drawBufferInfo(gl, cubeLinesBufferInfo, gl.LINES);
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const ext = gl.getExtension("WEBGL_depth_texture");
    if (!ext) {
      return alert("need WEBGL_depth_texture"); // eslint-disable-line
    }
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const colorProgramInfo = twgl.createProgramInfo(gl, [
      COLOR_VERTEX_ID,
      COLOR_FRAGMENT_ID,
    ]);
    programInfoRef.current = {
      programInfo,
      colorProgramInfo,
    };
    const depthTextureSize = 512;
    // console.log("start---");
    // make a 8x8 checkerboard texture
    const checkerboardTexture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, checkerboardTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // mip level
      gl.LUMINANCE, // internal format
      8, // width
      8, // height
      0, // border
      gl.LUMINANCE, // format
      gl.UNSIGNED_BYTE, // type
      new Uint8Array([
        // data
        0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff,
        0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc,
        0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc,
        0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
        0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff,
        0xcc, 0xff, 0xcc, 0xff,
      ])
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const depthTexture = gl.createTexture() as WebGLTexture;
    // const depthTextureSize = 512;
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, // target
      0, // mip level
      gl.DEPTH_COMPONENT, // internal format
      depthTextureSize, // width
      depthTextureSize, // height
      0, // border
      gl.DEPTH_COMPONENT, // format
      gl.UNSIGNED_INT, // type
      null
    ); // data
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // const depthFramebuffer = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    // gl.framebufferTexture2D(
    //   gl.FRAMEBUFFER, // target
    //   gl.DEPTH_ATTACHMENT, // attachment point
    //   gl.TEXTURE_2D, // texture target
    //   depthTexture, // texture
    //   0
    // ); // mip level

    // create a color texture of the same size as the depth texture
    // see article why this is needed_
    const unusedTexture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, unusedTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      depthTextureSize,
      depthTextureSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texturesRef.current = {
      depthTexture,
      bgTexture: checkerboardTexture,
      unusedTexture,
    };
    // texturesRef.current = twgl.createTextures(gl, {
    //   bgTexture: {
    //     type: gl.UNSIGNED_BYTE,
    //     width: 8,
    //     height: 8,
    //     internalFormat: gl.LUMINANCE,
    //     format: gl.LUMINANCE,
    //     mag: gl.NEAREST,
    //     src: new Uint8Array([
    //       // data
    //       0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc,
    //       0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc,
    //       0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff,
    //       0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff,
    //       0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
    //       0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
    //     ]),
    //   },
    //   depthTexture: {
    //     width: depthTextureSize,
    //     height: depthTextureSize,
    //     internalFormat: gl.DEPTH_COMPONENT,
    //     type: gl.UNSIGNED_INT,
    //     target: gl.TEXTURE_2D,
    //     format: gl.DEPTH_COMPONENT,
    //     level: 0,
    //     minMag: gl.NEAREST,
    //     wrapS: gl.CLAMP_TO_EDGE,
    //     wrapT: gl.CLAMP_TO_EDGE,
    //     // src: null,
    //   },
    //   unusedTexture: {
    //     target: gl.TEXTURE_2D,
    //     level: 0,
    //     internalFormat: gl.RGBA,
    //     width: depthTextureSize,
    //     height: depthTextureSize,
    //     format: gl.RGBA,
    //     type: gl.UNSIGNED_BYTE,
    //   },
    // });

    // const { unusedTexture, depthTexture } = texturesRef.current;
    // frameBufferInfoRef.current = twgl.createFramebufferInfo(
    //   gl,
    //   [
    //     {
    //       attachmentPoint: gl.DEPTH_ATTACHMENT,
    //       level: 0,
    //       target: gl.TEXTURE_2D,
    //       attachment: depthTexture,
    //     },
    //     {
    //       target: gl.TEXTURE_2D,
    //       attachmentPoint: gl.COLOR_ATTACHMENT0,
    //       attachment: unusedTexture,
    //       level: 0,
    //     },
    //   ],
    //   depthTextureSize,
    //   depthTextureSize
    // );
    const planeBufferInfo = primitives.createPlaneBufferInfo(gl, 20, 20, 1, 1);
    const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 1, 30, 30);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 2);
    const cubeLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        numComponents: 3,
        data: [
          -1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1,
          1, 1, 1, 1, 1,
        ],
      },
      indices: {
        numComponents: 2,
        data: [
          0, 1, 1, 3, 3, 2, 2, 0,

          4, 5, 5, 7, 7, 6, 6, 4,

          0, 4, 1, 5, 3, 7, 2, 6,
        ],
      },
    });
    primitiveInfosRef.current = {
      planeBufferInfo,
      sphereBufferInfo,
      cubeLinesBufferInfo,
      cubeBufferInfo,
    };
    frameBufferInfoRef.current = twgl.createFramebufferInfo(
      gl,
      [
        {
          attachmentPoint: gl.DEPTH_ATTACHMENT,
          level: 0,
          target: gl.TEXTURE_2D,
          attachment: depthTexture,
        },
        {
          target: gl.TEXTURE_2D,
          attachmentPoint: gl.COLOR_ATTACHMENT0,
          attachment: unusedTexture,
          level: 0,
        },
      ],
      depthTextureSize,
      depthTextureSize
    );
    render(config, yAngle);
  }, []);

  const handleYAngle = (evt: any, val: number | number[]) => {
    setYAngle(val as number);
  };

  useEffect(() => {
    console.log(yAngle);
    render(config, yAngle);
  }, [yAngle]);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", top: 0, left: 0, width: 320 }}>
        <Slider value={yAngle} onChange={handleYAngle} min={0} max={360} />
      </Box>
      <canvas ref={cavRef} width={1200} height={1000} />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={COLOR_VERTEX_ID} type="notjs">
        {colorVertexStr}
      </script>
      <script id={COLOR_FRAGMENT_ID} type="notjs">
        {colorFragmentStr}
      </script>
    </Box>
  );
}
