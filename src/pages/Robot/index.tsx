import React, { useRef, useEffect } from "react";
import Vector3 from "../../utils/vec3";
import * as webglUtils from "webgl-utils.js";
import Node from "../../utils/Node";
import TRS from "../../utils/TRS";
import {
  perspective,
  identity,
  multiply,
  lookAt,
  inverse,
} from "../../utils/matrix";
import { deg2radians } from "../../utils/math";
import { createCube, transformIndicesToUnIndices } from "../../utils/geometry";

const VERTEX_SHADER_NAME = "vertex-shader-3d";
const FRAGMENT_SHADER_NAME = "fragment-shader-3d";

const vertexShaderStr = `
    attribute vec4 a_position;
    attribute vec4 a_color;
    uniform mat4 u_matrix;

    varying vec4 v_color;

    void main() {
        gl_Position = u_matrix * a_position;
        v_color = a_color;
    }
`;

const fragmentShaderStr = `
    precision mediump float;
    varying vec4 v_color;

    uniform vec4 u_colorMult;
    uniform vec4 u_colorOffset;

    void main() {
        gl_FragColor = v_color * u_colorMult + u_colorOffset;
    }
`;

export default function Robot() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = cavElem.getContext("webgl") as WebGLRenderingContext;
    const programInfo = webglUtils.createProgramInfo(gl, [
      VERTEX_SHADER_NAME,
      FRAGMENT_SHADER_NAME,
    ]);
    debugger;
    const cubeOriginData = createCube(1, 1, 1);
    const { positions, colors, normals, texcoords } =
      transformIndicesToUnIndices(cubeOriginData) as any;
    const cubeData = {
      color: colors,
      position: positions,
      normal: normals,
      texcoord: texcoords,
    };
    const cubeBufferInfo = webglUtils.createBufferInfoFromArrays(gl, cubeData);
    let objectsToDraw: any[] = [];
    let objects: any[] = [];
    let nodeInfosByName: Record<string, any> = {};

    // Let's make all the nodes
    const blockGuyNodeDescriptions = {
      name: "point between feet",
      draw: false,
      children: [
        {
          name: "waist",
          translation: [0, 3, 0],
          children: [
            {
              name: "torso",
              translation: [0, 2, 0],
              children: [
                {
                  name: "neck",
                  translation: [0, 1, 0],
                  children: [
                    {
                      name: "head",
                      translation: [0, 1, 0],
                    },
                  ],
                },
                {
                  name: "left-arm",
                  translation: [-1, 0, 0],
                  children: [
                    {
                      name: "left-forearm",
                      translation: [-1, 0, 0],
                      children: [
                        {
                          name: "left-hand",
                          translation: [-1, 0, 0],
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "right-arm",
                  translation: [1, 0, 0],
                  children: [
                    {
                      name: "right-forearm",
                      translation: [1, 0, 0],
                      children: [
                        {
                          name: "right-hand",
                          translation: [1, 0, 0],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: "left-leg",
              translation: [-1, -1, 0],
              children: [
                {
                  name: "left-calf",
                  translation: [0, -1, 0],
                  children: [
                    {
                      name: "left-foot",
                      translation: [0, -1, 0],
                    },
                  ],
                },
              ],
            },
            {
              name: "right-leg",
              translation: [1, -1, 0],
              children: [
                {
                  name: "right-calf",
                  translation: [0, -1, 0],
                  children: [
                    {
                      name: "right-foot",
                      translation: [0, -1, 0],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    function makeNode(nodeDescription: any): Record<string, any> {
      var trs = new TRS();
      var node = new Node(trs);
      nodeInfosByName[nodeDescription.name] = {
        trs: trs,
        node: node,
      };
      trs.translation = nodeDescription.translation || trs.translation;
      if (nodeDescription.draw !== false) {
        node.drawInfo = {
          uniforms: {
            u_colorOffset: [0, 0, 0.6, 0],
            u_colorMult: [0.4, 0.4, 0.4, 1],
          },
          programInfo: programInfo,
          bufferInfo: cubeBufferInfo,
        };
        objectsToDraw.push(node.drawInfo);
        objects.push(node);
      }
      makeNodes(nodeDescription.children).forEach(function (child) {
        child.setParent(node);
      });

      return node;
    }

    function makeNodes(nodeDescriptions: any[]) {
      return nodeDescriptions ? nodeDescriptions.map(makeNode) : [];
    }

    const scene = makeNode(blockGuyNodeDescriptions);

    requestAnimationFrame(drawScene);

    function drawScene(time: number) {
      time *= 0.001;
      // debugger;
      // Tell WebGL how to convert from clip space to pixels
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      console.log("zzzzzzz");
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);

      // Clear the canvas AND the depth buffer.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Compute the projection matrix
      let aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      var projectionMatrix = perspective(60, aspect, 1, 2000, null);

      // Compute the camera's matrix using look at.
      var cameraPosition = new Vector3(4, 3.5, 10);
      var target = new Vector3(0, 3.5, 0);
      var up = new Vector3(0, 1, 0);
      var cameraMatrix = lookAt(cameraPosition, target, up, null);

      // Make a view matrix from the camera matrix.
      var viewMatrix = inverse(cameraMatrix, null);

      var viewProjectionMatrix = multiply(projectionMatrix, viewMatrix, null);

      // Draw objects

      // Update all world matrices in the scene graph
      scene.updateWorldMatrix();

      var adjust;
      var speed = 3;
      var c = time * speed;
      adjust = Math.abs(Math.sin(c));
      nodeInfosByName["point between feet"].trs.translation[1] = adjust;
      adjust = Math.sin(c);
      nodeInfosByName["left-leg"].trs.rotation[0] = adjust;
      nodeInfosByName["right-leg"].trs.rotation[0] = -adjust;
      adjust = Math.sin(c + 0.1) * 0.4;
      nodeInfosByName["left-calf"].trs.rotation[0] = -adjust;
      nodeInfosByName["right-calf"].trs.rotation[0] = adjust;
      adjust = Math.sin(c + 0.1) * 0.4;
      nodeInfosByName["left-foot"].trs.rotation[0] = -adjust;
      nodeInfosByName["right-foot"].trs.rotation[0] = adjust;

      adjust = Math.sin(c) * 0.4;
      nodeInfosByName["left-arm"].trs.rotation[2] = adjust;
      nodeInfosByName["right-arm"].trs.rotation[2] = adjust;
      adjust = Math.sin(c + 0.1) * 0.4;
      nodeInfosByName["left-forearm"].trs.rotation[2] = adjust;
      nodeInfosByName["right-forearm"].trs.rotation[2] = adjust;
      adjust = Math.sin(c - 0.1) * 0.4;
      nodeInfosByName["left-hand"].trs.rotation[2] = adjust;
      nodeInfosByName["right-hand"].trs.rotation[2] = adjust;

      adjust = Math.sin(c) * 0.4;
      nodeInfosByName["waist"].trs.rotation[1] = adjust;
      adjust = Math.sin(c) * 0.4;
      nodeInfosByName["torso"].trs.rotation[1] = adjust;
      adjust = Math.sin(c + 0.25) * 0.4;
      nodeInfosByName["neck"].trs.rotation[1] = adjust;
      adjust = Math.sin(c + 0.5) * 0.4;
      nodeInfosByName["head"].trs.rotation[1] = adjust;
      adjust = Math.cos(c * 2) * 0.4;
      nodeInfosByName["head"].trs.rotation[0] = adjust;

      // Compute all the matrices for rendering
      objects.forEach(function (object) {
        object.drawInfo.uniforms.u_matrix = multiply(
          viewProjectionMatrix,
          object.worldMatrix,
          null
        );
      });

      // ------ Draw the objects --------

      var lastUsedProgramInfo: any = null;
      var lastUsedBufferInfo: any = null;

      objectsToDraw.forEach(function (object) {
        var programInfo = object.programInfo;
        var bufferInfo = object.bufferInfo;
        var bindBuffers = false;

        if (programInfo !== lastUsedProgramInfo) {
          lastUsedProgramInfo = programInfo;
          gl.useProgram(programInfo.program);

          // We have to rebind buffers when changing programs because we
          // only bind buffers the program uses. So if 2 programs use the same
          // bufferInfo but the 1st one uses only positions the when the
          // we switch to the 2nd one some of the attributes will not be on.
          bindBuffers = true;
        }

        // Setup all the needed attributes.
        if (bindBuffers || bufferInfo !== lastUsedBufferInfo) {
          lastUsedBufferInfo = bufferInfo;
          webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        }

        // Set the uniforms.
        webglUtils.setUniforms(programInfo, object.uniforms);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
      });

      requestAnimationFrame(drawScene);
    }
  }, []);

  return (
    <div>
      <script id={VERTEX_SHADER_NAME} type="x-shader/x-vertex">
        {vertexShaderStr}
      </script>
      <script id={FRAGMENT_SHADER_NAME} type="x-shader/x-fragment">
        {fragmentShaderStr}
      </script>
      <canvas ref={cavRef} width={800} height={640} />
    </div>
  );
}
