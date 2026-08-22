const VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

varying vec2 vUv;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 rotate2D(vec2 p, float a){
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 getGradientColor(float t){
  float tt = clamp(t, 0.0, 1.0);
  int count = uColorCount;
  if (count < 2) count = 2;
  float scaled = tt * float(count - 1);
  float seg = floor(scaled);
  float f = fract(scaled);

  if (seg < 1.0) return mix(uColor0, uColor1, f);
  if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
  if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
  if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
  if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
  if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
  if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
  if (count > 7) return uColor7;
  if (count > 6) return uColor6;
  if (count > 5) return uColor5;
  if (count > 4) return uColor4;
  if (count > 3) return uColor3;
  if (count > 2) return uColor2;
  return uColor1;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv0 = fragCoord.xy / iResolution.xy;

    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv0 * 2.0 - 1.0;
    p.x *= aspect;
    vec2 pr = rotate2D(p, uAngle);
    pr.x /= aspect;
    vec2 uv = pr * 0.5 + 0.5;

    vec2 uvMod = uv;
    if (uDistort > 0.0) {
      float a = uvMod.y * 6.0;
      float b = uvMod.x * 6.0;
      float w = 0.01 * uDistort;
      uvMod.x += sin(a) * w;
      uvMod.y += cos(b) * w;
    }
    float t = uvMod.x;
    if (uMirror > 0.5) {
      t = 1.0 - abs(1.0 - 2.0 * fract(t));
    }
    vec3 base = getGradientColor(t);

    vec2 offset = vec2(iMouse.x/iResolution.x, iMouse.y/iResolution.y);
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float dn = d / r;
  float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
  vec3 cir = vec3(spot);
  float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
  if (uShineFlip > 0.5) stripe = 1.0 - stripe;
    vec3 ran = vec3(stripe);

    vec3 col = cir + base - ran;
    col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

    fragColor = vec4(col, 1.0);
}

void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
}
`;

const CONFIG = {
  colors: ["#FF9FFC", "#5227FF"],
  angle: 0,
  noise: 0.3,
  blindCount: 16,
  blindMinWidth: 60,
  mouseDampening: 0.15,
  mirrorGradient: false,
  spotlightRadius: 0.5,
  spotlightSoftness: 1,
  spotlightOpacity: 1,
  distortAmount: 0,
  shineDirection: "left",
};

function hexToRgb(hex) {
  const value = hex.replace("#", "").padEnd(6, "0");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
  }
  return program;
}

function setUniforms(gl, program, state) {
  const colors = CONFIG.colors.map(hexToRgb);
  while (colors.length < 8) colors.push(colors[colors.length - 1]);

  gl.uniform3f(
    gl.getUniformLocation(program, "iResolution"),
    gl.drawingBufferWidth,
    gl.drawingBufferHeight,
    1,
  );
  gl.uniform2f(gl.getUniformLocation(program, "iMouse"), state.mouse[0], state.mouse[1]);
  gl.uniform1f(gl.getUniformLocation(program, "iTime"), state.time);
  gl.uniform1f(gl.getUniformLocation(program, "uAngle"), (CONFIG.angle * Math.PI) / 180);
  gl.uniform1f(gl.getUniformLocation(program, "uNoise"), CONFIG.noise);
  gl.uniform1f(gl.getUniformLocation(program, "uBlindCount"), state.blindCount);
  gl.uniform1f(gl.getUniformLocation(program, "uSpotlightRadius"), CONFIG.spotlightRadius);
  gl.uniform1f(gl.getUniformLocation(program, "uSpotlightSoftness"), CONFIG.spotlightSoftness);
  gl.uniform1f(gl.getUniformLocation(program, "uSpotlightOpacity"), CONFIG.spotlightOpacity);
  gl.uniform1f(gl.getUniformLocation(program, "uMirror"), CONFIG.mirrorGradient ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(program, "uDistort"), CONFIG.distortAmount);
  gl.uniform1f(gl.getUniformLocation(program, "uShineFlip"), CONFIG.shineDirection === "right" ? 1 : 0);
  gl.uniform1i(gl.getUniformLocation(program, "uColorCount"), CONFIG.colors.length);

  colors.forEach((color, index) => {
    gl.uniform3f(gl.getUniformLocation(program, `uColor${index}`), color[0], color[1], color[2]);
  });
}

function initGradientBlinds(container) {
  const existingCanvas = container.querySelector("canvas");
  const canvas = existingCanvas || document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2", { alpha: true, antialias: true }) ||
    canvas.getContext("webgl", { alpha: true, antialias: true });

  if (!gl) {
    container.classList.add("gradient-blinds-fallback");
    return;
  }

  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  if (!existingCanvas) container.appendChild(canvas);

  const program = createProgram(gl);
  const positionLocation = gl.getAttribLocation(program, "position");
  const uvLocation = gl.getAttribLocation(program, "uv");
  const geometry = new Float32Array([
    -1, -1, 0, 0,
    3, -1, 2, 0,
    -1, 3, 0, 2,
  ]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const state = {
    target: [0, 0],
    mouse: [0, 0],
    blindCount: CONFIG.blindCount,
    time: 0,
    lastFrame: 0,
  };

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      state.target = [width / 2, height / 2];
      state.mouse = [width / 2, height / 2];
    }
    const cssWidth = Math.max(1, rect.width);
    state.blindCount = Math.max(1, Math.min(CONFIG.blindCount, Math.floor(cssWidth / CONFIG.blindMinWidth)));
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.target = [
      (event.clientX - rect.left) * dpr,
      (rect.height - (event.clientY - rect.top)) * dpr,
    ];
  }

  function render(timestamp) {
    resize();
    const delta = state.lastFrame ? (timestamp - state.lastFrame) / 1000 : 0;
    state.lastFrame = timestamp;
    state.time = timestamp * 0.001;

    const dampening = Math.max(0.0001, CONFIG.mouseDampening);
    const amount = Math.min(1, 1 - Math.exp(-delta / dampening));
    state.mouse[0] += (state.target[0] - state.mouse[0]) * amount;
    state.mouse[1] += (state.target[1] - state.mouse[1]) * amount;

    gl.useProgram(program);
    setUniforms(gl, program, state);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    window.requestAnimationFrame(render);
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  resize();
  window.requestAnimationFrame(render);
}

function boot() {
  document.querySelectorAll(".hero-blinds").forEach(initGradientBlinds);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
