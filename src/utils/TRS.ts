import { m4 } from "twgl.js";

export default class TRS {
  translation = [0, 0, 0];
  rotation = [0, 0, 0];
  scale = [1, 1, 1];

  constructor() {}

  getMatrix(dst?: m4.Mat4) {
    dst = dst || new Float32Array(16);
    var t = this.translation;
    var r = this.rotation;
    var s = this.scale;
    m4.translation(t, dst);
    m4.rotateX(dst, r[0], dst);
    m4.rotateY(dst, r[1], dst);
    m4.rotateZ(dst, r[2], dst);
    m4.scale(dst, s, dst);

    return dst;
  }
}
