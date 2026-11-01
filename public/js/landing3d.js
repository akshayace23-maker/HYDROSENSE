// js/landing3d.js — HydroSense interactive 3D water globe.
// Procedural globe texture, atmospheric edge lighting, report beacons, orbital paths,
// a subtle water-ripple field and drifting particles. Decorative only: it shows no live data.
import * as THREE from '/js/vendor/three.module.min.js';

const canvas = document.getElementById('heroCanvas');
const fallback = document.querySelector('.hero__fallback');

function canUseWebGL() {
  try {
    const test = document.createElement('canvas');
    return !!(test.getContext('webgl2') || test.getContext('webgl'));
  } catch (error) {
    return false;
  }
}

function makeGlobeTexture() {
  const width = 2048;
  const height = 1024;
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = width;
  mapCanvas.height = height;
  const ctx = mapCanvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#0c4268');
  ocean.addColorStop(0.48, '#087f9d');
  ocean.addColorStop(1, '#06365b');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  // Deep-water bands and a faint geographic graticule.
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.32, y - 24, width * 0.68, y + 24, width, y);
    ctx.strokeStyle = 'rgba(112, 232, 225, 0.045)';
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(160, 235, 238, 0.12)';
  ctx.lineWidth = 2;
  for (let lat = 1; lat < 12; lat++) {
    const y = (lat / 12) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lon = 1; lon < 24; lon++) {
    const x = (lon / 24) * width;
    ctx.beginPath();
    ctx.ellipse(x, height / 2, 20 + Math.abs(Math.sin(lon)) * 95, height * 0.49, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const land = ctx.createLinearGradient(0, height * 0.16, width * 0.1, height * 0.9);
  land.addColorStop(0, '#8bbf9c');
  land.addColorStop(0.48, '#4b9e83');
  land.addColorStop(1, '#286f68');
  ctx.fillStyle = land;
  ctx.strokeStyle = 'rgba(157, 245, 213, 0.7)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(87, 242, 214, 0.34)';
  ctx.shadowBlur = 18;

  // Stylised continent silhouettes on an equirectangular map.
  ctx.beginPath();
  ctx.moveTo(width * 0.075, height * 0.19);
  ctx.bezierCurveTo(width * 0.11, height * 0.12, width * 0.17, height * 0.13, width * 0.205, height * 0.20);
  ctx.bezierCurveTo(width * 0.235, height * 0.24, width * 0.216, height * 0.30, width * 0.19, height * 0.34);
  ctx.bezierCurveTo(width * 0.176, height * 0.40, width * 0.16, height * 0.43, width * 0.145, height * 0.48);
  ctx.bezierCurveTo(width * 0.12, height * 0.45, width * 0.112, height * 0.38, width * 0.092, height * 0.34);
  ctx.bezierCurveTo(width * 0.065, height * 0.30, width * 0.055, height * 0.24, width * 0.075, height * 0.19);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width * 0.205, height * 0.48);
  ctx.bezierCurveTo(width * 0.245, height * 0.47, width * 0.27, height * 0.52, width * 0.264, height * 0.59);
  ctx.bezierCurveTo(width * 0.257, height * 0.68, width * 0.236, height * 0.79, width * 0.22, height * 0.87);
  ctx.bezierCurveTo(width * 0.202, height * 0.82, width * 0.195, height * 0.73, width * 0.183, height * 0.66);
  ctx.bezierCurveTo(width * 0.17, height * 0.59, width * 0.178, height * 0.52, width * 0.205, height * 0.48);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width * 0.445, height * 0.25);
  ctx.bezierCurveTo(width * 0.48, height * 0.19, width * 0.53, height * 0.20, width * 0.55, height * 0.25);
  ctx.bezierCurveTo(width * 0.57, height * 0.29, width * 0.55, height * 0.34, width * 0.525, height * 0.36);
  ctx.bezierCurveTo(width * 0.49, height * 0.37, width * 0.46, height * 0.33, width * 0.445, height * 0.25);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width * 0.47, height * 0.37);
  ctx.bezierCurveTo(width * 0.515, height * 0.34, width * 0.56, height * 0.39, width * 0.566, height * 0.47);
  ctx.bezierCurveTo(width * 0.574, height * 0.57, width * 0.545, height * 0.72, width * 0.516, height * 0.81);
  ctx.bezierCurveTo(width * 0.49, height * 0.75, width * 0.475, height * 0.65, width * 0.46, height * 0.56);
  ctx.bezierCurveTo(width * 0.445, height * 0.47, width * 0.445, height * 0.41, width * 0.47, height * 0.37);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width * 0.55, height * 0.25);
  ctx.bezierCurveTo(width * 0.61, height * 0.16, width * 0.72, height * 0.16, width * 0.79, height * 0.23);
  ctx.bezierCurveTo(width * 0.86, height * 0.28, width * 0.91, height * 0.36, width * 0.87, height * 0.43);
  ctx.bezierCurveTo(width * 0.83, height * 0.48, width * 0.77, height * 0.43, width * 0.73, height * 0.46);
  ctx.bezierCurveTo(width * 0.68, height * 0.49, width * 0.65, height * 0.42, width * 0.615, height * 0.41);
  ctx.bezierCurveTo(width * 0.58, height * 0.39, width * 0.56, height * 0.33, width * 0.55, height * 0.25);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width * 0.77, height * 0.61);
  ctx.bezierCurveTo(width * 0.82, height * 0.58, width * 0.87, height * 0.62, width * 0.88, height * 0.67);
  ctx.bezierCurveTo(width * 0.875, height * 0.73, width * 0.83, height * 0.76, width * 0.795, height * 0.72);
  ctx.bezierCurveTo(width * 0.77, height * 0.69, width * 0.755, height * 0.65, width * 0.77, height * 0.61);
  ctx.fill(); ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(139, 219, 183, 0.82)';
  [[0.39,0.27,9],[0.405,0.29,5],[0.29,0.38,5],[0.69,0.53,7],[0.91,0.55,8],[0.935,0.57,4],[0.35,0.68,5]].forEach(function (p) {
    ctx.beginPath();
    ctx.arc(width * p[0], height * p[1], p[2], 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(mapCanvas);
  texture.anisotropy = 8;
  return texture;
}

if (!canvas || !canUseWebGL()) {
  if (canvas) canvas.style.display = 'none';
} else {
  try {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 10.8);

    scene.add(new THREE.AmbientLight(0x8edfea, 1.15));
    const keyLight = new THREE.DirectionalLight(0xe4ffff, 2.2);
    keyLight.position.set(-5, 4, 7);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x24d9d0, 2.8, 18);
    rimLight.position.set(4, -1, -3);
    scene.add(rimLight);
    const blueLight = new THREE.PointLight(0x248bff, 1.7, 16);
    blueLight.position.set(-4, -3, 1);
    scene.add(blueLight);

    const AQUA = new THREE.Color('#6df5dc');
    const SKY = new THREE.Color('#45bdf4');
    const globe = new THREE.Group();
    scene.add(globe);

    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(2.12, 112, 88),
      new THREE.MeshPhysicalMaterial({
        map: makeGlobeTexture(),
        roughness: 0.48,
        metalness: 0.12,
        clearcoat: 0.82,
        clearcoatRoughness: 0.2
      })
    );
    globe.add(surface);

    // Soft atmospheric edge around the planet.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 80, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: [
          'varying vec3 vNormal;',
          'varying vec3 vView;',
          'void main(){',
          '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
          '  vNormal = normalize(normalMatrix * normal);',
          '  vView = normalize(-mv.xyz);',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vNormal;',
          'varying vec3 vView;',
          'void main(){',
          '  float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.5);',
          '  gl_FragColor = vec4(0.18, 0.82, 0.94, rim * 0.72);',
          '}'
        ].join('\n')
      })
    );
    globe.add(atmosphere);

    // Fine geographic mesh, restrained so the surface remains readable.
    const graticule = new THREE.Mesh(
      new THREE.SphereGeometry(2.135, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x9af8ed, wireframe: true, transparent: true, opacity: 0.075 })
    );
    globe.add(graticule);

    // Three orbital tracks create a subtle monitoring-network motif.
    const orbitMaterials = [
      new THREE.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: 0.42 }),
      new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.23 }),
      new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.32 })
    ];
    const orbitRings = [];
    [[2.82, 1.1, 0.1], [3.02, 0.46, 1.0], [3.22, 1.85, -0.55]].forEach(function (v, i) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(v[0], 0.009, 8, 180), orbitMaterials[i]);
      ring.rotation.set(v[1], 0, v[2]);
      globe.add(ring);
      orbitRings.push(ring);
    });

    // Decorative report beacons distributed over the globe (not real report coordinates).
    const pins = [];
    const pinGeometry = new THREE.SphereGeometry(0.052, 16, 12);
    const haloGeometry = new THREE.RingGeometry(0.075, 0.105, 32);
    let seed = 17;
    function random() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    for (let i = 0; i < 26; i++) {
      const phi = Math.acos(2 * random() - 1);
      const theta = Math.PI * 2 * random();
      const normal = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      const color = random() > 0.82 ? new THREE.Color('#ffd27a') : AQUA;
      const pin = new THREE.Mesh(pinGeometry, new THREE.MeshBasicMaterial({ color: color, toneMapped: false }));
      pin.position.copy(normal).multiplyScalar(2.145);
      const halo = new THREE.Mesh(
        haloGeometry,
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false
        })
      );
      halo.position.copy(normal).multiplyScalar(2.15);
      halo.lookAt(normal.clone().multiplyScalar(4));
      globe.add(pin, halo);
      pins.push({ halo: halo, phase: random() * Math.PI * 2, speed: 0.65 + random() * 0.8 });
    }

    // Star-like particles behind the globe add depth without competing with the text.
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (random() - 0.5) * 25;
      starPositions[i * 3 + 1] = (random() - 0.5) * 15;
      starPositions[i * 3 + 2] = -5 - random() * 12;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x9ce9ed, size: 0.035, transparent: true, opacity: 0.5, sizeAttenuation: true })
    );
    scene.add(stars);

    // A low, gently animated water field anchors the globe in the hero.
    const gridSize = 62;
    const fieldSize = 25;
    const fieldPositions = new Float32Array(gridSize * gridSize * 3);
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const index = (x * gridSize + y) * 3;
        fieldPositions[index] = (x / (gridSize - 1) - 0.5) * fieldSize;
        fieldPositions[index + 1] = (y / (gridSize - 1) - 0.5) * fieldSize;
        fieldPositions[index + 2] = 0;
      }
    }
    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute('position', new THREE.BufferAttribute(fieldPositions, 3));
    const waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: [
        'uniform float uTime;',
        'uniform float uPixelRatio;',
        'varying float vHeight;',
        'varying float vFade;',
        'void main(){',
        '  vec3 p = position;',
        '  float wave = sin(p.x * 0.52 + uTime * 0.65) * 0.20 + sin(p.y * 0.44 + uTime * 0.52) * 0.17;',
        '  wave += sin((p.x + p.y) * 0.24 + uTime * 0.4) * 0.16;',
        '  p.z = wave;',
        '  vHeight = wave;',
        '  vFade = 1.0 - smoothstep(2.0, 13.0, length(p.xy));',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = uPixelRatio * (2.0 + wave * 1.5) * (8.0 / max(1.0, -mv.z));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vHeight;',
        'varying float vFade;',
        'void main(){',
        '  vec2 c = gl_PointCoord - 0.5;',
        '  float r = length(c);',
        '  if(r > 0.5) discard;',
        '  float glow = (1.0 - smoothstep(0.0, 0.5, r));',
        '  vec3 color = mix(vec3(0.12, 0.52, 0.85), vec3(0.28, 0.95, 0.82), smoothstep(-0.3, 0.4, vHeight));',
        '  gl_FragColor = vec4(color, glow * vFade * 0.42);',
        '}'
      ].join('\n')
    });
    const waterField = new THREE.Points(waterGeometry, waterMaterial);
    waterField.rotation.x = -1.28;
    waterField.position.set(0, -3.25, -1.2);
    scene.add(waterField);

    // Slow bubbles drift through the foreground.
    const bubbleCount = 42;
    const bubbleMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xa9f5ee, transparent: true, opacity: 0.17, depthWrite: false }),
      bubbleCount
    );
    const bubbles = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push({
        x: (random() - 0.5) * 15,
        y: -5 + random() * 11,
        z: -2 + random() * 4,
        size: 0.018 + random() * 0.045,
        velocity: 0.12 + random() * 0.24,
        phase: random() * Math.PI * 2
      });
    }
    scene.add(bubbleMesh);

    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    function resize() {
      const width = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const narrow = width < 900;
      globe.position.set(narrow ? 0 : 3.45, narrow ? 2.45 : 0.05, 0);
      globe.scale.setScalar(narrow ? 0.58 : 1);
      camera.position.z = narrow ? 12.2 : 10.8;
      waterField.position.y = narrow ? -3.8 : -3.25;
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    window.addEventListener('pointermove', function (event) {
      targetX = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      targetY = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    }, { passive: true });

    let visible = true;
    let running = false;
    const clock = new THREE.Clock();
    function renderFrame() {
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      const time = clock.getElapsedTime();
      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;

      globe.rotation.y = time * 0.075 + pointerX * 0.22;
      globe.rotation.x = 0.08 + pointerY * 0.1;
      orbitRings.forEach(function (ring, index) {
        ring.rotation.z += 0.00065 * (index % 2 ? -1 : 1);
        ring.rotation.y += 0.00035;
      });
      pins.forEach(function (pin) {
        const pulse = (Math.sin(time * pin.speed + pin.phase) + 1) * 0.5;
        pin.halo.scale.setScalar(1 + pulse * 2.1);
        pin.halo.material.opacity = 0.58 * (1 - pulse);
      });
      waterMaterial.uniforms.uTime.value = time;
      for (let i = 0; i < bubbleCount; i++) {
        const bubble = bubbles[i];
        bubble.y += bubble.velocity * 0.016;
        if (bubble.y > 6) bubble.y = -5;
        dummy.position.set(
          bubble.x + Math.sin(time * 0.45 + bubble.phase) * 0.2,
          bubble.y,
          bubble.z
        );
        dummy.scale.setScalar(bubble.size);
        dummy.updateMatrix();
        bubbleMesh.setMatrixAt(i, dummy.matrix);
      }
      bubbleMesh.instanceMatrix.needsUpdate = true;
      camera.position.x = pointerX * 0.22;
      camera.position.y = 0.35 + pointerY * 0.12;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      if (!reduceMotion) requestAnimationFrame(renderFrame);
      else running = false;
    }

    function start() {
      if (!running) {
        running = true;
        requestAnimationFrame(renderFrame);
      }
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      });
      observer.observe(canvas);
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) start();
    });

    if (fallback) fallback.style.opacity = '0.28';
    start();
    canvas.dataset.ready = '1';
  } catch (error) {
    console.error('[HydroSense 3D] WebGL scene could not be started:', error);
    canvas.style.display = 'none';
    if (fallback) fallback.style.opacity = '1';
  }
}
