import React, { useRef, useState, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import { Box, Slider, Typography } from "@mui/material";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

interface AxisUnit {
  x: number;
  y: number;
  z: number;
}

const VERTEX_SHADER_ID = "vertex-shader";
const FRAME_SHADER_ID = "frame-shader";
const COLOR_VERTEX_SHADER_ID = "color-vertex-shader";
const COLOR_FRAME_SHADER_ID = "color-frame-shader";

const vertexShaderStr = `
    attribute vec4 position;
    attribute vec2 texcoord;
    attribute vec3 normal;

    uniform mat4 u_world;
    uniform mat4 u_view;
    uniform mat4 u_projection;
    uniform mat4 u_textureMatrix;
    uniform vec3 u_lightWorldPosition;
    uniform vec3 u_viewWorldPosition;

    varying vec4 v_projectedTexcoord;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;

    void main(){
        vec4 worldPosition = u_world * position;
        gl_Position = u_projection * u_view * worldPosition;

        v_projectedTexcoord = u_textureMatrix * worldPosition;
        v_texCoord = texcoord;
        v_normal = mat3(u_world) * normal;
        vec3 surfaceWorldPosition = worldPosition.xyz;
        v_surfaceToLight = u_lightWorldPosition - surfaceWorldPosition;
        v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
    }
`;

const frameShaderStr = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform sampler2D u_projectionTexture;
    uniform vec4 u_colorMult;
    uniform float u_bias;
    uniform vec3 u_lightDirection;
    uniform float u_innerLimit;
    uniform float u_outerLimit;
    uniform float u_shininess;
    uniform float u_ambient;
    

    varying vec4 v_projectedTexcoord;
    varying vec2 v_texCoord;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;

    void main() {
        vec3 normal = normalize(v_normal);
        vec3 surfaceToLight = normalize(v_surfaceToLight);
        vec3 surfaceToView = normalize(v_surfaceToView);
        vec3 halfVector = normalize(surfaceToLight + surfaceToView);
        float dotFromDirection = dot(surfaceToLight, -u_lightDirection);
        float limitRange = u_innerLimit - u_outerLimit;
        float inLight = clamp((dotFromDirection - u_outerLimit) / limitRange ,0.0, 1.0);
        float light = inLight * dot(normal, surfaceToLight);
        float specular = inLight * pow(dot(normal, halfVector), u_shininess);

        vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
        float currentDepth = projectedTexcoord.z + u_bias;
        float projectedDepth = texture2D(u_projectionTexture, projectedTexcoord.xy).r;

        bool inRange = projectedTexcoord.x >= 0.0 
        && projectedTexcoord.x <= 1.0 
        && projectedTexcoord.y >= 0.0 
        && projectedTexcoord.y <= 1.0;

        vec4 texColor = texture2D(u_texture, v_texCoord) * u_colorMult;

        float shadowLight = (inRange && projectedDepth <= currentDepth) ? 0.0 : 1.0;
        gl_FragColor = vec4(texColor.rgb * light * shadowLight + texColor.rgb * u_ambient + specular * shadowLight + u_ambient, texColor.a);
    }
`;
const colorVertexShaderStr = `
    attribute vec4 position;
    
    uniform mat4 u_world;
    uniform mat4 u_view;
    uniform mat4 u_projection;

    void main(){
        gl_Position = u_projection * u_view * u_world * position;
    }
`;

const colorFrameShaderStr = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }
`;

export default function Shadows() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programInfoRef = useRef<Record<string, any>>({});
  const geometriesRef = useRef<Record<string, any>>({});
  const texturesRef = useRef<Record<string, WebGLTexture>>({});
  const frameBufferInfoRef = useRef<twgl.FramebufferInfo | null>(null);
  const [fieldOfView, setFieldView] = useState<number>(60);
  const [eyePosition, setEyePosition] = useState<AxisUnit>({
    x: 6.0,
    y: 5.0,
    z: 7,
  });
  const [lightPosition, setLightPosition] = useState<AxisUnit>({
    x: 2.5,
    y: 4.8,
    z: 4.3,
  });
  const [targetPosition, setTargetPosition] = useState<AxisUnit>({
    x: 2.5,
    y: 0,
    z: 3.5,
  });
  const [proRect, setProRect] = useState<{ width: number; height: number }>({
    width: 1,
    height: 1,
  });

  const drawGeometries = useCallback(
    (
      projectionMatrix: twgl.m4.Mat4,
      cameraMatrix: twgl.m4.Mat4,
      textureMatrix: twgl.m4.Mat4,
      lightWorldMatrix: twgl.m4.Mat4,
      programInfo: twgl.ProgramInfo,
      fieldOfView: number
    ) => {
      const gl = glRef.current as WebGLRenderingContext;
      const { planeBufferInfo, sphereBufferInfo, cubeBufferInfo } =
        geometriesRef.current;
      const { texture, depthTexture } = texturesRef.current;
      gl.useProgram(programInfo.program);
      const viewMatrix = m4.inverse(cameraMatrix);
      console.log(lightWorldMatrix.slice(12, 15));
      // 设置common uniforms
      twgl.setUniforms(programInfo, {
        u_projection: projectionMatrix,
        u_view: viewMatrix,
        u_ambient: 0,
        u_textureMatrix: textureMatrix,
        u_texture: texture,
        u_projectionTexture: depthTexture,
        u_bias: -0.006,
        u_shininess: 150,
        u_innerLimit: Math.cos(deg2radians(fieldOfView / 2 - 10)),
        u_outerLimit: Math.cos(deg2radians(fieldOfView / 2)),
        u_lightDirection: lightWorldMatrix.slice(8, 11).map((v) => -v),
        u_lightWorldPosition: lightWorldMatrix.slice(12, 15),
        u_viewWorldPosition: cameraMatrix.slice(12, 15),
      });

      // 设置平面bufferInfo
      twgl.setUniforms(programInfo, {
        u_view: viewMatrix,
        u_world: m4.identity(),
        u_color: [1, 0, 0, 1],
        u_colorMult: [0.5, 0.5, 1, 1],
      });
      twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
      gl.drawElements(
        gl.TRIANGLES,
        planeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );

      // 设置立方体
      twgl.setUniforms(programInfo, {
        u_world: m4.translation([3, 1, 0]),
        u_color: [0, 0, 1, 1],
        u_colorMult: [0.5, 0.5, 1, 1],
      });
      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
      gl.drawElements(
        gl.TRIANGLES,
        cubeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
      // 设置球体
      twgl.setUniforms(programInfo, {
        u_world: m4.translation([2, 3, 4]),
        u_color: [0, 0, 1, 1],
        u_colorMult: [1, 0.5, 0.5, 1],
      });
      twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
      gl.drawElements(
        gl.TRIANGLES,
        sphereBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
    },
    []
  );

  const render = useCallback(
    (
      lpos: AxisUnit,
      tpos: AxisUnit,
      eyePos: AxisUnit,
      rectInfo: { width: number; height: number },
      fieldOfView: number
    ) => {
      const gl = glRef.current as WebGLRenderingContext;
      const { programInfo, colorProgramInfo } = programInfoRef.current;
      const { texture, depthTexture, unusedTexture } = texturesRef.current;
      const frameBufferInfo =
        frameBufferInfoRef.current as twgl.FramebufferInfo;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      // 第一步先以光照的位置
      let aspect = rectInfo.width / rectInfo.height;
      const lightProjectionMatrix = m4.perspective(
        deg2radians(fieldOfView),
        aspect,
        0.5,
        10
      );
      const lightCameraPos = [lpos.x, lpos.y, lpos.z];
      const target = [tpos.x, tpos.y, tpos.z];
      const up = [0, 1, 0];
      const lightMatrix = m4.lookAt(lightCameraPos, target, up);
      twgl.bindFramebufferInfo(gl, frameBufferInfo);
      //   gl.viewport(0, 0, 512, 512);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawGeometries(
        lightProjectionMatrix,
        lightMatrix,
        m4.identity(),
        lightMatrix,
        colorProgramInfo,
        fieldOfView
      );

      //   twgl.resizeFramebufferInfo(
      //     gl,
      //     frameBufferInfo,
      //     gl.canvas.width,
      //     gl.canvas.height
      //   );
      twgl.bindFramebufferInfo(gl, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      // const m4.identity();
      const eyePosition = [eyePos.x, eyePos.y, eyePos.z];
      const cameraMatrix = m4.lookAt(eyePosition, [0, 0, 0], up);

      let textureMatrix = m4.translation([0.5, 0.5, 0.5]);
      textureMatrix = m4.scale(textureMatrix, [0.5, 0.5, 0.5]);
      const tempMatrix = m4.multiply(
        lightProjectionMatrix,
        m4.inverse(lightMatrix)
      );
      textureMatrix = m4.multiply(textureMatrix, tempMatrix);
      aspect = gl.canvas.width / gl.canvas.height;
      const projectionMatrix = m4.perspective(
        deg2radians(fieldOfView),
        aspect,
        1,
        2000
      );
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawGeometries(
        projectionMatrix,
        cameraMatrix,
        textureMatrix,
        lightMatrix,
        programInfo,
        fieldOfView
      );
      const viewMatrix = m4.inverse(cameraMatrix);
      gl.useProgram(colorProgramInfo.program);
      const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
        position: [
          -1,
          -1,
          -1, //0
          1,
          -1,
          -1, //1
          -1,
          1,
          -1, //2
          1,
          1,
          -1, //3
          -1,
          -1,
          1, //4
          1,
          -1,
          1, //5
          -1,
          1,
          1, //6
          1,
          1,
          1, //7
        ],
        indices: [
          0, 1, 1, 3, 3, 2, 2, 0,

          4, 5, 5, 7, 7, 6, 6, 4,

          0, 4, 1, 5, 3, 7, 2, 6,
        ],
      });
      //   console.log(primitives.createCubeVertices(1));
      //   const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 1);
      const mat = m4.multiply(lightMatrix, m4.inverse(lightProjectionMatrix));

      twgl.setUniforms(colorProgramInfo, {
        u_color: [0, 0, 0, 1],
        u_view: viewMatrix,
        u_projection: projectionMatrix,
        u_world: mat,
      });
      twgl.setBuffersAndAttributes(gl, colorProgramInfo, cubeBufferInfo);
      gl.drawElements(
        gl.LINES,
        cubeBufferInfo.numElements,
        gl.UNSIGNED_SHORT,
        0
      );
    },
    []
  );

  // 初始化数据
  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const ext = gl.getExtension("WEBGL_depth_texture");
    if (!ext) {
      return alert("need WEBGL_depth_texture"); // eslint-disable-line
    }
    const programInfo = twgl.createProgramInfo(gl, [
      VERTEX_SHADER_ID,
      FRAME_SHADER_ID,
    ]);
    const colorProgramInfo = twgl.createProgramInfo(gl, [
      COLOR_VERTEX_SHADER_ID,
      COLOR_FRAME_SHADER_ID,
    ]);
    programInfoRef.current = {
      programInfo,
      colorProgramInfo,
    };
    geometriesRef.current = {
      cubeBufferInfo: primitives.createCubeBufferInfo(gl, 2),
      sphereBufferInfo: primitives.createSphereBufferInfo(gl, 1, 30, 30),
      planeBufferInfo: primitives.createPlaneBufferInfo(gl, 20, 20),
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

    // attach it to the framebuffer
    // gl.framebufferTexture2D(
    //   gl.FRAMEBUFFER, // target
    //   gl.COLOR_ATTACHMENT0, // attachment point
    //   gl.TEXTURE_2D, // texture target
    //   unusedTexture, // texture
    //   0
    // ); // mip level
    texturesRef.current = {
      texture: checkerboardTexture,
      depthTexture,
      unusedTexture,
    };
    // texturesRef.current = twgl.createTextures(gl, {
    //   texture: {
    //     // target: gl.TEXTURE_2D,
    //     mag: gl.NEAREST,
    //     min: gl.LINEAR,
    //     format: gl.LUMINANCE,
    //     // internalFormat: gl.LUMINANCE,
    //     width: 8,
    //     height: 8,
    //     // type: gl.UNSIGNED_BYTE,
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
    //     // target: gl.TEXTURE_2D,
    //     width: depthTextureSize,
    //     height: depthTextureSize,
    //     internalFormat: gl.DEPTH_COMPONENT,
    //     format: gl.DEPTH_COMPONENT,
    //     minMag: gl.NEAREST,
    //     // wrapS: gl.CLAMP_TO_EDGE,
    //     // wrapT: gl.CLAMP_TO_EDGE,
    //     wrap: gl.CLAMP_TO_EDGE,
    //     type: gl.UNSIGNED_INT,
    //   },
    //   unusedTexture: {
    //     width: depthTextureSize,
    //     height: depthTextureSize,
    //     minMag: gl.NEAREST,
    //     // mag: gl.NEAREST,
    //     wrapS: gl.CLAMP_TO_EDGE,
    //     wrapT: gl.CLAMP_TO_EDGE,
    //     type: gl.UNSIGNED_BYTE,
    //   },
    // });
    // console.log("end---");
    // debugger;
    frameBufferInfoRef.current = twgl.createFramebufferInfo(
      gl,
      [
        {
          attachmentPoint: gl.DEPTH_ATTACHMENT,
          level: 0,
          target: gl.TEXTURE_2D,
          attachment: texturesRef.current.depthTexture,
        },
        {
          target: gl.TEXTURE_2D,
          attachmentPoint: gl.COLOR_ATTACHMENT0,
          attachment: texturesRef.current.unusedTexture,
          level: 0,
        },
      ],
      depthTextureSize,
      depthTextureSize
    );
  }, []);

  useEffect(() => {
    render(lightPosition, targetPosition, eyePosition, proRect, fieldOfView);
  }, [lightPosition, targetPosition, eyePosition, proRect, fieldOfView]);

  const handleXEyeChange = useCallback((evt: any, val: number | number[]) => {
    setEyePosition((prev) => ({ ...prev, x: val as number }));
  }, []);
  const handleYEyeChange = useCallback((evt: any, val: number | number[]) => {
    setEyePosition((prev) => ({ ...prev, y: val as number }));
  }, []);
  const handleZEyeChange = useCallback((evt: any, val: number | number[]) => {
    setEyePosition((prev) => ({ ...prev, z: val as number }));
  }, []);
  const handleXTargetChange = useCallback(
    (evt: any, val: number | number[]) => {
      setTargetPosition((prev) => ({ ...prev, x: val as number }));
    },
    []
  );
  const handleYTargetChange = useCallback(
    (evt: any, val: number | number[]) => {
      setTargetPosition((prev) => ({ ...prev, y: val as number }));
    },
    []
  );
  const handleZTargetChange = useCallback(
    (evt: any, val: number | number[]) => {
      setTargetPosition((prev) => ({ ...prev, z: val as number }));
    },
    []
  );
  const handleXLightChange = useCallback((evt: any, val: number | number[]) => {
    setLightPosition((prev) => ({ ...prev, x: val as number }));
  }, []);
  const handleYLightChange = useCallback((evt: any, val: number | number[]) => {
    setLightPosition((prev) => ({ ...prev, y: val as number }));
  }, []);
  const handleZLightChange = useCallback((evt: any, val: number | number[]) => {
    setLightPosition((prev) => ({ ...prev, z: val as number }));
  }, []);
  const handleWRectChange = useCallback((evt: any, val: number | number[]) => {
    setProRect((prev) => ({ ...prev, width: val as number }));
  }, []);
  const handleHRectChange = useCallback((evt: any, val: number | number[]) => {
    setProRect((prev) => ({ ...prev, height: val as number }));
  }, []);
  const handleFieldOfViewChange = useCallback(
    (evt: any, val: number | number[]) => {
      setFieldView(val as number);
    },
    []
  );

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", width: 320, right: 20 }}>
        <Typography variant="h5" gutterBottom component="div">
          FOV
        </Typography>
        <Slider
          value={fieldOfView}
          onChange={handleFieldOfViewChange}
          min={0}
          max={200}
          step={1}
        />
        <Typography variant="h5" gutterBottom component="div">
          照相机
        </Typography>
        <Slider
          value={eyePosition.x}
          onChange={handleXEyeChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={eyePosition.y}
          onChange={handleYEyeChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={eyePosition.z}
          onChange={handleZEyeChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Typography variant="h5" gutterBottom component="div">
          目标
        </Typography>
        <Slider
          value={targetPosition.x}
          onChange={handleXTargetChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={targetPosition.y}
          onChange={handleYTargetChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={targetPosition.z}
          onChange={handleZTargetChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Typography variant="h5" gutterBottom component="div">
          灯光方向
        </Typography>
        <Slider
          value={lightPosition.x}
          onChange={handleXLightChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={lightPosition.y}
          onChange={handleYLightChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Slider
          value={lightPosition.z}
          onChange={handleZLightChange}
          min={-40}
          max={80}
          step={0.1}
        />
        <Typography variant="h5" gutterBottom component="div">
          视角大小
        </Typography>
        <Slider
          value={proRect.width}
          onChange={handleWRectChange}
          min={0}
          max={10}
          step={0.1}
        />
        <Slider
          value={proRect.height}
          onChange={handleHRectChange}
          min={0}
          max={10}
          step={0.1}
        />
      </Box>
      <canvas ref={cavRef} width={1200} height={960} />
      <script id={VERTEX_SHADER_ID} type="notjs">
        {vertexShaderStr}
      </script>
      <script id={FRAME_SHADER_ID} type="notjs">
        {frameShaderStr}
      </script>
      <script id={COLOR_VERTEX_SHADER_ID} type="notjs">
        {colorVertexShaderStr}
      </script>
      <script id={COLOR_FRAME_SHADER_ID} type="notjs">
        {colorFrameShaderStr}
      </script>
    </Box>
  );
}
