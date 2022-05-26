interface ProgramInfo {
  program: Program;
  uniformSetters(...rest: any[]): any;
  attribSetters(...rest: any[]): any;
}

declare module "webgl-utils.js" {
  export function createBufferInfoFromArrays(...rest: any[]): any;
  export function createProgramInfo(...rest: any[]): ProgramInfo;
  export function createAugmentedTypedArray(...rest: any[]): ProgramInfo;
  export function createUniformSetters(...rest: any[]): any;
  export function setBuffersAndAttributes(...rest: any[]): any;
  export function setUniforms(...rest: any[]): any;
  export function resizeCanvasToDisplaySize(...rest: any[]): any;
}
