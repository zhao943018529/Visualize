/**
 * @param x y z 球心的位置
 * @param radius 半径
 * @param divideByYAxis
 * @param divideByCircle
 */

import { positions } from "@mui/system";

export function createSphere(
  x: number,
  y: number,
  z: number,
  radius: number,
  divideByYAxis: number,
  divideByCircle: number
) {
  const positions = [];
  const yUnitAngle = Math.PI / divideByYAxis;
  const xUnitAngel = (Math.PI * 2) / divideByCircle;
  for (let i = 0; i <= divideByYAxis; ++i) {
    const yValue = radius * Math.cos(i * yUnitAngle) + y;
    const yCurrentRadius = radius * Math.sin(i * yUnitAngle);

    for (let j = 0; j <= divideByCircle; ++j) {
      const xValue = yCurrentRadius * Math.cos(xUnitAngel * j) + x;
      const zValue = yCurrentRadius * Math.sin(xUnitAngel * j) + z;
      positions.push(xValue, yValue, zValue);
    }
  }

  let indices: number[] = [];
  const circleCount = divideByCircle + 1;
  for (let j = 0; j < divideByCircle; ++j) {
    for (let i = 0; i < divideByYAxis; ++i) {
      let r1 = circleCount * i + j;
      let r2 = circleCount * (i + 1) + j;
      indices.push(r1, r1 + 1, r2);
      indices.push(r2, r1 + 1, r2 + 1);
    }
  }

  return {
    positions,
    indices,
  };
}
// export export function createSphere2(
//   radius: number,
//   divideByYAxis: number,
//   divideByCircle: number
// ) {
//   let yUnitAngle = Math.PI / divideByYAxis;
//   let circleUnitAngle = (Math.PI * 2) / divideByCircle;
//   let positions = [];
//   let normals = [];
//   for (let i = 0; i <= divideByYAxis; i++) {
//     let unitY = Math.cos(yUnitAngle * i);
//     let yValue = radius * unitY;

//     for (let j = 0; j <= divideByCircle; j++) {
//       let unitX = Math.sin(yUnitAngle * i) * Math.cos(circleUnitAngle * j);
//       let unitZ = Math.sin(yUnitAngle * i) * Math.sin(circleUnitAngle * j);
//       let xValue = radius * unitX;
//       let zValue = radius * unitZ;
//       positions.push(xValue, yValue, zValue);
//       normals.push(unitX, unitY, unitZ);
//     }
//   }

//   let indices = [];
//   let circleCount = divideByCircle + 1;
//   for (let j = 0; j < divideByCircle; j++) {
//     for (let i = 0; i < divideByYAxis; i++) {
//       indices.push(i * circleCount + j);
//       indices.push(i * circleCount + j + 1);
//       indices.push((i + 1) * circleCount + j);

//       indices.push((i + 1) * circleCount + j);
//       indices.push(i * circleCount + j + 1);
//       indices.push((i + 1) * circleCount + j + 1);
//     }
//   }
//   return {
//     positions,
//     indices,
//     normals,
//   };
// }

let CUBE_FACE_INDICES = [
  [0, 1, 2, 3], //前面
  [4, 5, 6, 7], //后面
  [0, 3, 5, 4], //左面
  [1, 7, 6, 2], //右面
  [3, 2, 6, 5], //上面
  [0, 4, 7, 1], //下面
];
export function createFace(
  width: number,
  height: number,
  depth: number,
  color: number[]
) {
  let zeroX = width / 2;
  let zeroY = height / 2;
  let zeroZ = depth || 0.5;
  let cornerPositions = [
    [-zeroX, -zeroY, zeroZ],
    [zeroX, -zeroY, zeroZ],
    [zeroX, zeroY, zeroZ],
    [-zeroX, zeroY, zeroZ],
    [-zeroX, -zeroY, -zeroZ],

    [-zeroX, zeroY, -zeroZ],
    [zeroX, zeroY, -zeroZ],
    [zeroX, -zeroY, -zeroZ],
  ];
  let colorInput = [color || [0, 255, 0, 255]];
  let normalInput = [
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  let texcoordsInput = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let colors: number[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices = [];
  let texcoords: number[] = [];
  for (let f = 0; f < 1; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    let normal = normalInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
      normals = normals.concat(normal);
      texcoords = texcoords.concat(texcoordsInput[v]);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  const indices1 = new Uint16Array(indices);
  const positions1 = new Float32Array(positions);
  const colors1 = new Uint8Array(colors);
  const normals1 = new Float32Array(normals);
  const texcoords1 = new Float32Array(texcoords);
  console.log("texcooords", texcoords);
  return {
    positions: positions1,
    indices: indices1,
    colors: colors1,
    normals: normals1,
    texcoords: texcoords1,
  };
}
export function createWing(
  topWidth: number,
  bottomWidth: number,
  height: number,
  depth: number
) {
  let zeroXLeft = topWidth / 2;
  let zeroXRight = zeroXLeft / 2 + (bottomWidth - topWidth);
  let zeroY = height / 2;
  let zeroZ = depth / 2;

  let cornerPositions = [
    [-zeroXLeft, -zeroY, zeroZ],
    [zeroXRight, -zeroY, zeroZ],
    [zeroXLeft, zeroY, zeroZ],
    [-zeroXLeft, zeroY, zeroZ],
    [-zeroXLeft, -zeroY, -zeroZ],

    [-zeroXLeft, zeroY, -zeroZ],
    [zeroXLeft, zeroY, -zeroZ],
    [zeroXRight, -zeroY, -zeroZ],
  ];
  let colorInput = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
  ];
  let normalInput = [
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  let texcoordsInput = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let colors: number[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices: number[] = [];
  let texcoords: number[] = [];
  for (let f = 0; f < 6; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    let normal = normalInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
      normals = normals.concat(normal);
      texcoords = texcoords.concat(texcoordsInput[v]);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  const indices1 = new Uint16Array(indices);
  const positions1 = new Float32Array(positions);
  const colors1 = new Uint8Array(colors);
  const normals1 = new Float32Array(normals);
  const texcoords1 = new Float32Array(texcoords);
  console.log("texcooords", texcoords);
  return {
    positions: positions1,
    indices: indices1,
    colors: colors1,
    normals: normals1,
    texcoords: texcoords1,
  };
}

export function createCube(width: number, height: number, depth: number) {
  let zeroX = width / 2;
  let zeroY = height / 2;
  let zeroZ = depth / 2;

  let cornerPositions = [
    [-zeroX, -zeroY, zeroZ],
    [zeroX, -zeroY, zeroZ],
    [zeroX, zeroY, zeroZ],
    [-zeroX, zeroY, zeroZ],
    [-zeroX, -zeroY, -zeroZ],

    [-zeroX, zeroY, -zeroZ],
    [zeroX, zeroY, -zeroZ],
    [zeroX, -zeroY, -zeroZ],
  ];
  let colorInput = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
  ];
  let normalInput = [
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  let texcoordsInput = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let colors: number[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices: number[] = [];
  let texcoords: number[] = [];
  for (let f = 0; f < 6; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    let normal = normalInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
      normals = normals.concat(normal);
      texcoords = texcoords.concat(texcoordsInput[v]);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  const indices1 = new Uint16Array(indices);
  const positions1 = new Float32Array(positions);
  const colors1 = new Uint8Array(colors);
  const normals1 = new Float32Array(normals);
  const texcoords1 = new Float32Array(texcoords);

  return {
    positions: positions1,
    indices: indices1,
    colors: colors1,
    normals: normals1,
    texcoords: texcoords1,
  };
}

export function createCubeForOther(
  width: number,
  height: number,
  depth: number
) {
  let zeroX = width / 2;
  let zeroY = height / 2;
  let zeroZ = depth / 2;

  let cornerPositions = [
    [-zeroX, -zeroY, zeroZ],
    [zeroX, -zeroY, zeroZ],
    [zeroX, zeroY, zeroZ],
    [-zeroX, zeroY, zeroZ],
    [-zeroX, -zeroY, -zeroZ],

    [-zeroX, zeroY, -zeroZ],
    [zeroX, zeroY, -zeroZ],
    [zeroX, -zeroY, -zeroZ],
  ];
  let colorInput = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
  ];
  let normalInput = [
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  let texcoordsInput = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let colors: number[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices: number[] = [];
  let texcoords: number[] = [];
  for (let f = 0; f < 6; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    let normal = normalInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
      normals = normals.concat(normal);
      texcoords = texcoords.concat(texcoordsInput[v]);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  const indices1 = new Uint16Array(indices);
  const positions1 = new Float32Array(positions);
  const colors1 = new Uint8Array(colors);
  const normals1 = new Float32Array(normals);
  const texcoords1 = new Float32Array(texcoords);

  return {
    position: positions1,
    indices: indices1,
    color: colors1,
    normal: normals1,
    texcoord: texcoords1,
  };
}

export function createLongCube(
  width: number,
  height: number,
  depth: number,
  repeatCount: number
) {
  let zeroX = width / 2;
  let zeroY = height / 2;
  let zeroZ = depth / 2;

  let cornerPositions = [
    [-zeroX, -zeroY, zeroZ],
    [zeroX, -zeroY, zeroZ],
    [zeroX, zeroY, zeroZ],
    [-zeroX, zeroY, zeroZ],
    [-zeroX, -zeroY, -zeroZ],

    [-zeroX, zeroY, -zeroZ],
    [zeroX, zeroY, -zeroZ],
    [zeroX, -zeroY, -zeroZ],
  ];
  let colorInput = [
    [255, 10, 40, 255],
    [10, 255, 40, 255],
    [10, 40, 255, 255],
    [255, 255, 10, 255],
    [10, 255, 255, 255],
    [255, 10, 255, 255],
  ];
  let normalInput = [
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  let texcoordsInput = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let colors: number[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices: number[] = [];
  let texcoords: number[] = [];
  for (let f = 0; f < 6; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    let normal = normalInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
      normals = normals.concat(normal);
      texcoords = texcoords.concat(texcoordsInput[v]);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  for (let i = 1; i < repeatCount; i++) {
    let index = 2;
    if (i == repeatCount - 1) {
      index = 1;
    }
    index = 0;
    for (let f = 0; f < 6 - index; ++f) {
      let faceIndices = CUBE_FACE_INDICES[f + index];
      let color = colorInput[f + index];
      let normal = normalInput[f + index];
      for (let v = 0; v < 4; ++v) {
        let position = cornerPositions[faceIndices[v]];
        positions.push(position[0], position[1], position[2] - i * depth);
        colors = colors.concat(color);
        normals = normals.concat(normal);
        texcoords = texcoords.concat(texcoordsInput[v]);
      }
      let offset = 24 * i + 4 * f;
      indices.push(offset + 0, offset + 1, offset + 2);
      indices.push(offset + 0, offset + 2, offset + 3);
    }
  }
  const indices1 = new Uint16Array(indices);
  const positions1 = new Float32Array(positions);
  const colors1 = new Uint8Array(colors);
  const normals1 = new Float32Array(normals);
  const texcoords1 = new Float32Array(texcoords);
  console.log("texcooords", texcoords);
  return {
    positions: positions1,
    indices: indices1,
    colors: colors1,
    normals: normals1,
    texcoords: texcoords1,
  };
}
export function createSphere2(
  radius: number,
  divideByYAxis: number,
  divideByCircle: number
) {
  let yUnitAngle = Math.PI / divideByYAxis;
  let circleUnitAngle = (Math.PI * 2) / divideByCircle;
  let positions = [];
  let normals = [];
  for (let i = 0; i <= divideByYAxis; i++) {
    let unitY = Math.cos(yUnitAngle * i);
    let yValue = radius * unitY;

    for (let j = 0; j <= divideByCircle; j++) {
      let unitX = Math.sin(yUnitAngle * i) * Math.cos(circleUnitAngle * j);
      let unitZ = Math.sin(yUnitAngle * i) * Math.sin(circleUnitAngle * j);
      let xValue = radius * unitX;
      let zValue = radius * unitZ;
      positions.push(xValue, yValue, zValue);
      normals.push(unitX, unitY, unitZ);
    }
  }

  let indices = [];
  let circleCount = divideByCircle + 1;
  for (let j = 0; j < divideByCircle; j++) {
    for (let i = 0; i < divideByYAxis; i++) {
      indices.push(i * circleCount + j);
      indices.push(i * circleCount + j + 1);
      indices.push((i + 1) * circleCount + j);

      indices.push((i + 1) * circleCount + j);
      indices.push(i * circleCount + j + 1);
      indices.push((i + 1) * circleCount + j + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    normals: new Float32Array(normals),
  };
}

export function createCone(
  topRadius: number,
  bottomRadius: number,
  height: number,
  bottomDivide: number,
  verticalDivide: number,
  topColor?: Record<string, any>,
  bottomColor?: Record<string, any>,
  verticalColor?: Record<string, any>
) {
  let positions = [];
  let vertex = {};
  let indices = [];
  let normals = [];
  let colors = [];
  let atanθ = Math.atan2(bottomRadius - topRadius, height);
  let cosAtanθ = Math.cos(atanθ);
  let sinAtanθ = Math.sin(atanθ);
  let color = bottomColor || { r: 200, g: 200, b: 200, a: 255 };

  for (let i = -1; i <= verticalDivide + 1; i++) {
    let currentRadius = 0;
    if (i > verticalDivide) {
      currentRadius = topRadius;
    } else if (i < 0) {
      currentRadius = bottomRadius;
    } else {
      currentRadius =
        bottomRadius + (topRadius - bottomRadius) * (i / verticalDivide);
    }
    let yValue = (height * i) / verticalDivide - height / 2;
    if (i == -1 || i == verticalDivide + 1) {
      color = bottomColor || { r: 100, g: 100, b: 100, a: 255 };
      currentRadius = 0;
      if (i == -1) {
        yValue = -height / 2;
      } else {
        yValue = height / 2;
      }
    } else {
      color = { r: 100, g: 100, b: 100, a: 255 };
    }
    for (let j = 0; j <= bottomDivide; j++) {
      let xUnit = Math.sin((j * Math.PI * 2) / bottomDivide);
      let zUnit = Math.cos((j * Math.PI * 2) / bottomDivide);
      let xValue = currentRadius * xUnit;
      var zValue = currentRadius * zUnit;
      positions.push(xValue, yValue, zValue);
      normals.push(
        i < 0 || i > verticalDivide ? 0 : xUnit * cosAtanθ,
        i < 0 ? -1 : i > verticalDivide ? 1 : sinAtanθ,
        i < 0 || i > verticalDivide ? 0 : zUnit * cosAtanθ
      );
      colors.push(color.r, color.g, color.b, color.a);
    }
  }

  // indices
  let vertexCountPerRadius = bottomDivide + 1;
  for (let i = 0; i < verticalDivide + 2; i++) {
    for (let j = 0; j < bottomDivide; j++) {
      indices.push(i * vertexCountPerRadius + j);
      indices.push(i * vertexCountPerRadius + j + 1);
      indices.push((i + 1) * vertexCountPerRadius + j + 1);

      indices.push(
        vertexCountPerRadius * (i + 0) + j,
        vertexCountPerRadius * (i + 1) + j + 1,
        vertexCountPerRadius * (i + 1) + j
      );
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    normals: new Float32Array(normals),
    colors: new Uint8Array(colors),
  };
}
export function getElementsCountPerVertex(attribute: string) {
  let result = 3;
  switch (attribute) {
    case "colors":
      result = 4;
      break;
    case "indices":
      result = 1;
      break;
    case "texcoords":
      result = 2;
      break;
  }
  return result;
}
export function getArrayTypeByAttribName(attribute: string) {
  switch (attribute) {
    case "colors":
      return Uint8Array;
    case "indices":
      return Uint16Array;
    default:
      return Float32Array;
  }
}

interface Unindices {
  positions: Float32Array;
  indices: Uint16Array;
  normals: Float32Array;
  colors?: Float32Array;
}

export function transformIndicesToUnIndices(
  vertex: Record<string, any>
): Unindices {
  let indices = vertex.indices;
  let vertexsCount = indices.length;
  let destVertex = {} as Unindices;

  Object.keys(vertex).forEach(function (attribute) {
    if (attribute == "indices") {
      return;
    }
    let src = vertex[attribute];
    let elementsPerVertex = getElementsCountPerVertex(attribute);
    let dest = [];
    let index = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = 0; j < elementsPerVertex; j++) {
        dest[index] = src[indices[i] * elementsPerVertex + j];
        index++;
      }
    }
    let type = getArrayTypeByAttribName(attribute);
    (destVertex as Record<string, any>)[attribute] = new type(dest);
  });
  return destVertex;
}

export function createStone(
  top: number,
  bottom: number,
  height: number,
  xDivider: number = 10,
  yDivider: number = 10
) {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let j = 0; j <= xDivider; j++) {
    positions.push(0, height, 0);
    normals.push(0, 1, 0);
  }
  for (let i = 0; i <= yDivider; i++) {
    const curHeight = height - (height / yDivider) * i;
    const curRadius = bottom - ((bottom - top) / height) * curHeight;
    for (let j = 0; j <= xDivider; j++) {
      const curAngle = ((Math.PI * 2) / xDivider) * j;
      const xUnit = Math.cos(curAngle);
      const zUnit = Math.sin(curAngle);
      positions.push(xUnit * curRadius, curHeight, zUnit * curRadius);
      normals.push(xUnit, 1, zUnit);
    }
  }
  for (let j = 0; j <= xDivider; j++) {
    positions.push(0, 0, 0);
    normals.push(0, -1, 0);
  }

  const indices: number[] = [];
  const count = xDivider + 1;
  for (let j = 0; j <= xDivider; j++) {
    for (let i = 0; i <= yDivider + 1; ++i) {
      indices.push(i * count + j);
      indices.push(i * count + j + 1);
      indices.push((i + 1) * count + j);
      indices.push((i + 1) * count + j);
      indices.push(i * count + j + 1);
      indices.push((i + 1) * count + j + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    normals: new Float32Array(normals),
  };
}

export function createTorus(
  row: number,
  column: number,
  irad: number,
  orad: number
) {
  const rowRadians = (Math.PI * 2) / row;
  const colRadians = (Math.PI * 2) / column;
  const mergeRad = irad + orad;
  let positions: number[] = [];
  let indices: number[] = [];
  let normals: number[] = [];

  for (let r = 0; r <= row; ++r) {
    const curRowRadians = r * rowRadians;
    for (let c = 0; c <= column; ++c) {
      const curColRadians = colRadians * c;
      const zVal = Math.sin(curColRadians) * orad;
      const partialXVal = Math.cos(curColRadians) * orad;
      let xVal = mergeRad + partialXVal;
      let realY = Math.sin(curRowRadians) * xVal;
      let realX = Math.cos(curRowRadians) * xVal;
      positions.push(realX, realY, zVal);
      normals.push(Math.cos(curColRadians), Math.sin(curRowRadians), zVal);
    }
  }
  for (let r = 0; r < row; ++r) {
    for (let c = 0; c < column; ++c) {
      let a = (column + 1) * r + c;
      indices.push(a, a + column + 1, a + 1);
      indices.push(a + column + 1, a + column + 2, a + 1);
    }
  }

  return {
    position: positions,
    indices: indices,
    normal: normals,
  };
}
