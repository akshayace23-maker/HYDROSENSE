// js/landing3d.js — HydroSense hero scene (three.js, self-hosted, ES module).
// A living "water globe": a glass planet wrapped in a wireframe, glowing report pins that pulse,
// a rippling field of light particles as the water surface, and rising bubbles.
// Pure decoration — it shows no data. Pauses when off-screen / tab hidden; static for reduced-motion;
// falls back to a CSS gradient when WebGL is unavailable.
import * as THREE from '/js/vendor/three.module.min.js';

const canvas = document.getElementById('heroCanvas');
const fallback = document.querySelector('.hero__fallback');

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

if (!canvas || !webglOK()) {
  if (canvas) canvas.style.display = 'none';
} else {
  if (fallback) fallback.style.opacity = '0.5';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.6, 11);

  const AQUA = new THREE.Color('#5eead4'), SKY = new THREE.Color('#38bdf8'), DEEP = new THREE.Color('#0b3b78');

  // ---------- Globe group
  const globe = new THREE.Group();
  scene.add(globe);

  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, cA: { value: AQUA }, cB: { value: DEEP } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vP = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 cA; uniform vec3 cB; varying vec3 vN; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vP))), 2.4);
        float band = 0.5 + 0.5*sin(vN.y*7.0 + uTime*0.8);
        vec3 col = mix(cB, cA, f*0.9 + band*0.12);
        gl_FragColor = vec4(col, 0.28 + f*0.62); }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.2, 64, 64), coreMat);
  globe.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.26, 3),
    new THREE.MeshBasicMaterial({ color: AQUA, wireframe: true, transparent: true, opacity: 0.16 })
  );
  globe.add(wire);

  // Orbit rings
  const ringMat = new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.35 });
  const rings = [];
  [[3.05, 0.012, 1.2, 0.2], [3.45, 0.008, 0.5, 1.1], [2.8, 0.01, 1.9, -0.6]].forEach(([r, w, rx, rz]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 160), ringMat);
    m.rotation.set(rx, 0, rz); globe.add(m); rings.push(m);
  });

  // Report pins (decorative) with pulsing halos
  const pins = [];
  const pinGeo = new THREE.SphereGeometry(0.055, 12, 12);
  const haloGeo = new THREE.RingGeometry(0.07, 0.1, 24);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) {
    const phi = Math.acos(2 * rnd() - 1), theta = 2 * Math.PI * rnd();
    const pos = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(2.24);
    const warm = rnd() > 0.78;
    const col = warm ? new THREE.Color('#fbbf24') : AQUA;
    const pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color: col }));
    pin.position.copy(pos);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    halo.position.copy(pos); halo.lookAt(pos.clone().multiplyScalar(2));
    globe.add(pin, halo);
    pins.push({ pin, halo, off: rnd() * 6.28, speed: 0.8 + rnd() * 0.9 });
  }

  // ---------- Rippling particle water surface
  const N = 150, SIZE = 26;
  const pos = new Float32Array(N * N * 3);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = (i * N + j) * 3;
    pos[k] = (i / (N - 1) - 0.5) * SIZE; pos[k + 1] = (j / (N - 1) - 0.5) * SIZE; pos[k + 2] = 0;
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, cA: { value: AQUA }, cB: { value: SKY }, uPtr: { value: new THREE.Vector2(0, 0) } },
    vertexShader: `uniform float uTime; uniform float uPx; uniform vec2 uPtr; varying float vH; varying float vFade;
      void main(){ vec3 p = position;
        float d = length(p.xy - uPtr*6.0);
        float h = sin(p.x*0.55 + uTime*0.9)*0.28 + sin(p.y*0.48 + uTime*0.7)*0.24 + sin((p.x+p.y)*0.27 + uTime*0.5)*0.34
                + sin(d*1.4 - uTime*2.2)*0.18*exp(-d*0.28);
        p.z = h; vH = h;
        vFade = smoothstep(13.0, 3.0, length(p.xy));
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = (2.8 + h*1.6) * uPx * (9.0 / -mv.z);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cA; uniform vec3 cB; varying float vH; varying float vFade;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if(r>0.5) discard;
        vec3 col = mix(cB, cA, smoothstep(-0.5, 0.8, vH));
        gl_FragColor = vec4(col, (0.55 - r)*vFade*1.5); }`,
  });
  const water = new THREE.Points(waterGeo, waterMat);
  water.rotation.x = -1.28; water.position.set(0, -3.6, -1.5);
  scene.add(water);

  // ---------- Rising bubbles
  const BUB = 70;
  const bubGeo = new THREE.SphereGeometry(1, 12, 12);
  const bubMat = new THREE.MeshBasicMaterial({ color: 0xbff6ee, transparent: true, opacity: 0.16, depthWrite: false });
  const bubbles = new THREE.InstancedMesh(bubGeo, bubMat, BUB);
  const bdata = [];
  for (let i = 0; i < BUB; i++) bdata.push({ x: (rnd() - 0.5) * 16, y: -5 + rnd() * 11, z: -3 + rnd() * 6, s: 0.02 + rnd() * 0.055, v: 0.12 + rnd() * 0.3, w: rnd() * 6 });
  scene.add(bubbles);
  const dummy = new THREE.Object3D();

  // ---------- Layout + interaction
  let ptrX = 0, ptrY = 0, tx = 0, ty = 0;
  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = w < 900;
    globe.position.set(narrow ? 0 : 3.6, narrow ? 3.1 : 0.2, 0);
    const sc = narrow ? 0.62 : 1; globe.scale.setScalar(sc);
    camera.position.z = narrow ? 12.5 : 11;
  }
  window.addEventListener('resize', resize);
  resize();
  window.addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });

  let visible = true, running = false;
  const clock = new THREE.Clock();

  function frame() {
    if (!visible || document.hidden) { running = false; return; }
    const t = clock.getElapsedTime();
    ptrX += (tx - ptrX) * 0.05; ptrY += (ty - ptrY) * 0.05;
    coreMat.uniforms.uTime.value = t; waterMat.uniforms.uTime.value = t;
    waterMat.uniforms.uPtr.value.set(ptrX, ptrY);
    globe.rotation.y = t * 0.12 + ptrX * 0.35;
    globe.rotation.x = 0.2 + ptrY * 0.18;
    rings.forEach((r, i) => { r.rotation.z += 0.0014 * (i % 2 ? -1 : 1); r.rotation.y += 0.0009; });
    pins.forEach((p) => {
      const k = (Math.sin(t * p.speed + p.off) + 1) / 2;
      p.halo.scale.setScalar(1 + k * 2.4); p.halo.material.opacity = 0.65 * (1 - k);
    });
    for (let i = 0; i < BUB; i++) {
      const b = bdata[i]; b.y += b.v * 0.016; if (b.y > 6) b.y = -5;
      dummy.position.set(b.x + Math.sin(t * 0.6 + b.w) * 0.25, b.y, b.z); dummy.scale.setScalar(b.s); dummy.updateMatrix();
      bubbles.setMatrixAt(i, dummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    camera.position.x = ptrX * 0.4; camera.position.y = 0.6 + ptrY * 0.25; camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (!reduce) requestAnimationFrame(frame); else running = false;
  }
  function start() { if (!running) { running = true; requestAnimationFrame(frame); } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
  canvas.dataset.ready = '1';
}
