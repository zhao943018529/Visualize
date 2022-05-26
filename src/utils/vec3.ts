/*3维向量构造函数
 *
 * @param {*} x
 * @param {*} y
 * @param {*} z
 */
export default class Vector3 {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  constructor(x?: number, y?: number, z?: number) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  setX(x: number) {
    this.x = x || 0;
    return this;
  }

  setY(y: number) {
    this.y = y || 0;
    return this;
  }

  setZ(z: number) {
    this.z = z || 0;
    return this;
  }

  set(x: number, y: number, z: number) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  /**
   * 归一化向量
   *
   * @param {*} vec
   */
  normalize(vec?: Vector3) {
    var length = this.length();

    if (length > 0.00001) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }
    return this;
  }

  /**
   *向量加法
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  addVector(vec1: Vector3, vec2: Vector3) {
    this.x = vec1.x + vec2.x;
    this.y = vec1.y + vec2.y;
    this.z = vec1.z + vec2.z;
    return this;
  }

  /**
   *向量长度
   *
   * @param {*} vec
   */
  length(vec?: Vector3): number {
    if (vec) {
      return vec.length();
    }
    return Math.sqrt(this.lengthSquare());
  }

  /**
   *向量长度的平方
   *
   * @param {*} vec
   */
  lengthSquare(vec?: Vector3): number {
    if (vec) {
      return vec.lengthSquare();
    }
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   *向量加法
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  add(vec1: Vector3, vec2?: Vector3) {
    if (vec2) {
      return this.addVector(vec1, vec2);
    }
    this.x += vec1.x;
    this.y += vec1.y;
    this.z += vec1.z;
    return this;
  }

  /**
   *向量减法，类方法
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  static subtractVectors(vec1: Vector3, vec2: Vector3) {
    return new Vector3(vec1.x - vec2.x, vec1.y - vec2.y, vec1.z - vec2.z);
  }

  /**
   *向量减法，实例方法
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  sub(vec1: Vector3, vec2: Vector3) {
    if (vec2) {
      vec2.set(-vec2.x, -vec2.y, -vec2.z);

      return this.addVector(vec1, vec2);
    }
    this.x -= vec1.x;
    this.y -= vec1.y;
    this.z -= vec1.z;
    return this;
  }

  /**
   *向量逐分量相乘
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  multiplyVectors(vec1: Vector3, vec2: Vector3) {
    this.x = vec1.x * vec2.x;
    this.y = vec1.y * vec2.y;
    this.z = vec1.z * vec2.z;
    return this;
  }

  /**
   *向量点积
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  dot(vec1: Vector3, vec2: Vector3) {
    return vec1.x * vec2.x + vec1.y * vec2.y + vec1.z * vec2.z;
  }

  /**
   *向量差积
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  static cross(vec1: Vector3, vec2: Vector3) {
    var x = vec1.y * vec2.z - vec2.y * vec1.z;
    var y = vec2.x * vec1.z - vec1.x * vec2.z;
    var z = vec1.x * vec2.y - vec1.y * vec2.x;
    return new Vector3(x, y, z);
  }

  /**
   * 归一化向量
   *
   * @param {*} vec
   */
  static normalize(vec: Vector3): Vector3 {
    var length = vec.length();
    if (length > 0.00001) {
      return new Vector3(vec.x / length, vec.y / length, vec.z / length);
    }
    return new Vector3();
  }

  /**
   *向量逐分量相乘
   *
   * @param {*} vec1
   * @param {*} vec2
   */
  multiply(vec1: Vector3, vec2: Vector3): Vector3 {
    if (vec2) {
      return this.multiplyVectors(vec1, vec2);
    }
    this.x *= vec1.x;
    this.y *= vec1.y;
    this.z *= vec1.z;
    return this;
  }
}
