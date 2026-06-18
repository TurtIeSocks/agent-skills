// glass-webgl.js — Tier 3 reference: real-time refractive glass in WebGL.
//
// A fragment shader refracts + chromatically disperses + lights a DRAWABLE
// backdrop, per frame. Unlike `backdrop-filter: url()` (Chromium-only), this
// runs in every WebGL browser (Firefox/Safari included) and refracts LIVE
// video/canvas smoothly.
//
// ponytail: this is a REFERENCE, not a drop-in. The backdrop must be drawable
// (img/canvas/video). Refracting arbitrary live DOM means snapshotting DOM to a
// canvas first (html2canvas — slow/fragile); out of scope. Scope: glass over
// media. One GL context per panel; reserve for the surface that truly needs it.

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision highp float;
varying vec2 uv;
uniform sampler2D tex;   // backdrop
uniform vec4 region;     // sub-rect of the backdrop the glass covers (x,y,w,h), 0..1
uniform vec2 res;        // glass size, px
uniform float radius;    // corner radius, px
uniform float bezel;     // refracting rim width, px
uniform vec2 light;      // specular light position, uv 0..1
uniform float aberration;

// rounded-box signed distance (centered, px); <0 inside
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }

void main(){
  vec2 px = uv * res;
  vec2 c = res * 0.5;
  float d = sdRound(px - c, c, radius);
  if (d > 0.0) discard;                      // outside the rounded panel
  float edge = clamp(-d / bezel, 0.0, 1.0);  // 0 at rim -> 1 inside bezel
  float rim = 1.0 - edge;                     // strong at rim, ~0 in centre

  // barrel refraction: sample the backdrop pushed toward centre, hardest at rim
  vec2 nrm = normalize(px - c + 1e-4);
  vec2 off = -nrm * pow(rim, 1.5) * 0.05 * region.zw;
  vec2 base = region.xy + uv * region.zw;

  // chromatic aberration: R and B sample at slightly different displacement
  float r = texture2D(tex, base + off * (1.0 + aberration)).r;
  float g = texture2D(tex, base + off).g;
  float b = texture2D(tex, base + off * (1.0 - aberration)).b;
  vec3 col = vec3(r, g, b);

  col = mix(col, col * 1.06 + 0.03, 0.6);     // gentle saturate/lift (the "tint")
  col += vec3(0.07) * rim;                     // fresnel edge brighten
  float s = pow(max(0.0, 1.0 - distance(uv, light) * 2.2), 8.0) * rim * 1.3;
  col += vec3(s);                              // specular glint near the light pos

  float a = clamp(-d, 0.0, 1.0);              // 1px edge AA
  gl_FragColor = vec4(col, a);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('glass-webgl shader: ' + log);
  }
  return sh;
}

/**
 * Set up refractive WebGL glass on `canvas`, refracting `source` (a drawable
 * img/canvas/video) behind the region `opts.region` (x,y,w,h in 0..1 of the
 * source — the slice the panel sits over). Returns controls.
 *
 * @returns {{ render(): void, setLight(x:number,y:number): void, destroy(): void }}
 */
export function createWebGLGlass(canvas, source, opts = {}) {
  const { region = [0, 0, 1, 1], radius = 24, bezel = 28, aberration = 0.12 } = opts;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
  if (!gl) throw new Error('glass-webgl: WebGL unavailable');

  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteProgram(prog);
    throw new Error('glass-webgl link: ' + log);
  }
  // shaders are linked into the program now; detach + delete so they don't leak
  gl.detachShader(prog, vs);
  gl.detachShader(prog, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const U = (n) => gl.getUniformLocation(prog, n);
  const uLight = U('light');
  let light = [0.35, 0.25];

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return; // source not ready / tainted
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1i(U('tex'), 0);
    gl.uniform4f(U('region'), region[0], 1 - region[1] - region[3], region[2], region[3]);
    gl.uniform2f(U('res'), canvas.width, canvas.height);
    gl.uniform1f(U('radius'), radius);
    gl.uniform1f(U('bezel'), bezel);
    gl.uniform1f(U('aberration'), aberration);
    gl.uniform2f(uLight, light[0], light[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render();
  return {
    render,
    setLight(x, y) {
      light = [x, y];
      render();
    },
    /** Update the backdrop sub-rect the panel covers (x,y,w,h in 0..1) — call on resize. */
    setRegion(r) {
      region[0] = r[0];
      region[1] = r[1];
      region[2] = r[2];
      region[3] = r[3];
      render();
    },
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteTexture(tex);
    },
  };
}

export default createWebGLGlass;
