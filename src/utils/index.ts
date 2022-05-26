export function getGraphContext(elem: HTMLCanvasElement) {
  return elem.getContext("webgl") || elem.getContext("experimental-webgl");
}

export function shaderHelper(
  context: WebGLRenderingContext,
  type: number,
  shaderStr: string
) {
  const shaderTarget = context.createShader(type) as WebGLShader;
  context.shaderSource(shaderTarget, shaderStr);

  context.compileShader(shaderTarget);

  return shaderTarget;
}

export function programHelper(
  ctx: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) {
  const program = ctx.createProgram() as WebGLProgram;
  ctx.attachShader(program, vertexShader);
  ctx.attachShader(program, fragmentShader);
  ctx.linkProgram(program);

  return program;
}

export function render(gl: WebGLRenderingContext, type: number, count: number) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(type, 0, count);
}

export function renderElements(
  gl: WebGLRenderingContext,
  count: number,
  category: number = gl.UNSIGNED_SHORT,
  offset: number = 0
) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawElements(gl.TRIANGLES, count, category, offset);
}

export function loadImageTexure(
  gl: WebGLRenderingContext,
  src: string,
  uAttr: WebGLUniformLocation,
  callback: () => void
) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = (evt) => {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.uniform1i(uAttr, 0);
    callback && callback();
  };
  img.src = src;
}

export function randomColor(): number[] {
  return [Math.random() * 255, Math.random() * 255, Math.random() * 255, 1];
}

export function createCirclePoints(
  x: number,
  y: number,
  r: number,
  count: number
) {
  let points: number[] = [];
  const colors = randomColor();

  for (let i = 0; i <= count; i++) {
    const angle = (i * Math.PI * 2) / count;
    points.push(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      colors[0],
      colors[1],
      colors[2],
      colors[3]
    );
  }

  // let indices: number[] = [];
  // for (let i = 0; i < count; ++i) {
  //   let p0 = i * 2;
  //   let p1 = i * 2 + 1;
  //   let p2 = (i + 1) * 2 + 1;
  //   if (i == count - 1) {
  //     p2 = 0;
  //   }
  //   indices.push(p0, p1);
  // }

  return points;
}

const CUBE_FACE_INDICES = [
  [0, 1, 2, 3], //前面
  [4, 5, 6, 7], //后面
  [0, 3, 5, 4], //左面
  [1, 7, 6, 2], //右面
  [3, 2, 6, 5], //上面
  [0, 4, 7, 1], // 下面
];

export function createCube(width: number, height: number, depth: number) {
  let zeroX = width / 2;
  let zeroY = height / 2;
  let zeroZ = depth / 2;

  let cornerPositions = [
    [-zeroX, -zeroY, -zeroZ],
    [zeroX, -zeroY, -zeroZ],
    [zeroX, zeroY, -zeroZ],
    [-zeroX, zeroY, -zeroZ],
    [-zeroX, -zeroY, zeroZ],
    [-zeroX, zeroY, zeroZ],
    [zeroX, zeroY, zeroZ],
    [zeroX, -zeroY, zeroZ],
  ];
  let colorInput = [
    [255, 0, 0, 1],
    [0, 255, 0, 1],
    [0, 0, 255, 1],
    [255, 255, 0, 1],
    [0, 255, 255, 1],
    [255, 0, 255, 1],
  ];

  let colors: number[] = [];
  let positions: number[] = [];
  let indices: number[] = [];

  for (let f = 0; f < 6; ++f) {
    let faceIndices = CUBE_FACE_INDICES[f];
    let color = colorInput[f];
    for (let v = 0; v < 4; ++v) {
      let position = cornerPositions[faceIndices[v]];
      positions = positions.concat(position);
      colors = colors.concat(color);
    }
    let offset = 4 * f;
    indices.push(offset + 0, offset + 1, offset + 2);
    indices.push(offset + 0, offset + 2, offset + 3);
  }
  let indicesArry = new Uint16Array(indices);
  let positionsArry = new Float32Array(positions);
  let colorsArry = new Float32Array(colors);

  return {
    positions: positionsArry,
    indices: indicesArry,
    colors: colorsArry,
  };
}

interface ColorObj {
  r: number;
  g: number;
  b: number;
  a: number;
}

const random = Math.random;
export function randomColor2() {
  return {
    r: random() * 255,
    g: random() * 255,
    b: random() * 255,
    a: random() * 1,
  };
}

export function createColorForVertex(
  vertex: Record<string, any>,
  c?: ColorObj
): { indices: any; normals: any; positions: any; colors: any } {
  let vertexNums = vertex.positions;
  let colors = [];
  let color = c || {
    r: 255,
    g: 0,
    b: 0,
    a: 255,
  };

  for (let i = 0; i < vertexNums.length; i++) {
    color = c || randomColor2();
    colors.push(color.r, color.g, color.b, 255);
  }

  vertex.colors = new Uint8Array(colors);

  return vertex as any;
}

export function loadCubeImages(urls: string[]) {
  return Promise.all<HTMLImageElement>(
    urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = url;
          img.onerror = () => reject("加载纹理图片错误!");
        })
    )
  );
}
