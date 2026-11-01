// js/landing3d.js — HydroSense cinematic river/lake hero with live WebGL water motion.
// The landscape is the background image; this transparent Three.js layer adds animated
// 3D surface displacement, directional river streaks, water sparkle and lake ripples.
// It is decorative only and does not display live monitoring or water-quality data.
import * as THREE from '/js/vendor/three.module.min.js';

(function () {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('heroCanvas');
  const fallback = document.querySelector('.hero__fallback');
  if (!hero || !canvas) return;

  const backgroundUrl = '/css/images/hero-river.webp';
  const desktopGradient = 'linear-gradient(90deg, rgba(2, 18, 25, 0.99) 0%, rgba(2, 18, 25, 0.99) 35%, rgba(2, 18, 25, 0.94) 46%, rgba(2, 18, 25, 0.68) 57%, rgba(2, 18, 25, 0.20) 76%, rgba(2, 18, 25, 0.04) 100%), linear-gradient(0deg, rgba(1, 16, 22, 0.24), rgba(1, 16, 22, 0.02))';
  const mobileGradient = 'linear-gradient(180deg, rgba(2, 18, 25, 0.78) 0%, rgba(2, 18, 25, 0.60) 45%, rgba(2, 18, 25, 0.34) 100%)';

  // Keep the existing HTML header, headline, buttons and statistics fully functional.
  const style = document.createElement('style');
  style.textContent = `
    .hero { background-color:#062b3b !important; background-image:${desktopGradient}, url('${backgroundUrl}') !important; background-size:cover !important; background-position:50% 50% !important; }
    .hero__canvas { position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; z-index:1 !important; pointer-events:none !important; display:block !important; }
    .hero__fallback { opacity:0 !important; }
    .hero__inner, .hero__scroll { position:relative; z-index:2 !important; }
    .hero__scroll { position:absolute !important; }
    @media (max-width:900px) {
      .hero { background-image:${mobileGradient}, url('${backgroundUrl}') !important; background-position:70% 50% !important; }
    }
    @media (prefers-reduced-motion: reduce) { .hero__canvas { opacity:.62; } }
  `;
  document.head.appendChild(style);

  function createMaskTexture() {
    // Red channel = lake; green channel = river. Coordinates match hero-river.webp.
    const width = 1024;
    const height = 512;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    const lake = document.createElement('canvas');
    lake.width = width; lake.height = height;
    const lakeCtx = lake.getContext('2d');
    lakeCtx.fillStyle = '#fff';
    lakeCtx.beginPath();
    lakeCtx.moveTo(width * 0.575, height * 0.345);
    lakeCtx.bezierCurveTo(width * 0.67, height * 0.315, width * 0.83, height * 0.32, width, height * 0.34);
    lakeCtx.lineTo(width, height * 0.625);
    lakeCtx.bezierCurveTo(width * 0.91, height * 0.625, width * 0.82, height * 0.60, width * 0.75, height * 0.565);
    lakeCtx.bezierCurveTo(width * 0.68, height * 0.53, width * 0.625, height * 0.49, width * 0.59, height * 0.42);
    lakeCtx.closePath();
    lakeCtx.fill();

    const river = document.createElement('canvas');
    river.width = width; river.height = height;
    const riverCtx = river.getContext('2d');
    riverCtx.strokeStyle = '#fff';
    riverCtx.lineCap = 'round';
    riverCtx.lineJoin = 'round';
    riverCtx.lineWidth = height * 0.145;
    riverCtx.beginPath();
    riverCtx.moveTo(width * 0.455, height * 0.435);
    riverCtx.bezierCurveTo(width * 0.50, height * 0.48, width * 0.515, height * 0.545, width * 0.575, height * 0.605);
    riverCtx.bezierCurveTo(width * 0.64, height * 0.675, width * 0.72, height * 0.70, width * 0.79, height * 0.82);
    riverCtx.bezierCurveTo(width * 0.86, height * 0.91, width * 0.94, height * 0.965, width * 1.04, height * 1.02);
    riverCtx.stroke();

    const lakePixels = lakeCtx.getImageData(0, 0, width, height).data;
    const riverPixels = riverCtx.getImageData(0, 0, width, height).data;
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      image.data[i * 4] = lakePixels[i * 4 + 3];
      image.data[i * 4 + 1] = riverPixels[i * 4 + 3];
      image.data[i * 4 + 2] = 0;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(maskCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  function startScene() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      console.warn('[HydroSense water hero] WebGL unavailable; showing the still landscape.', error);
      canvas.style.display = 'none';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5);
    camera.position.z = 1;
    const maskTexture = createMaskTexture();
    const uniforms = {
      uTime: { value: 0 },
      uMask: { value: maskTexture },
      // x/y are image crop origin; z/w are visible image width/height fractions.
      uCrop: { value: new THREE.Vector4(0, 1, 0, 1) }
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms,
      vertexShader: `
        uniform float uTime;
        uniform sampler2D uMask;
        uniform vec4 uCrop;
        varying vec2 vUv;
        varying float vLift;
        void main() {
          vUv = uv;
          vec2 imageUv = uCrop.xy + vec2(uv.x, 1.0 - uv.y) * uCrop.zw;
          vec4 mask = texture2D(uMask, vec2(imageUv.x, 1.0 - imageUv.y));
          float water = max(mask.r, mask.g);
          float waveA = sin(uv.x * 82.0 + uv.y * 45.0 - uTime * 2.4);
          float waveB = sin(uv.x * 46.0 - uv.y * 38.0 - uTime * 1.55);
          vLift = water * (waveA * 0.55 + waveB * 0.45);
          vec3 p = position;
          p.z += vLift * 0.018;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uMask;
        uniform vec4 uCrop;
        varying vec2 vUv;
        varying float vLift;
        void main() {
          vec2 imageUv = uCrop.xy + vec2(vUv.x, 1.0 - vUv.y) * uCrop.zw;
          vec4 mask = texture2D(uMask, vec2(imageUv.x, 1.0 - imageUv.y));
          float lake = mask.r;
          float river = mask.g;
          float water = max(lake, river);
          if (water < 0.025) discard;

          // Diagonal directional streaks move downstream through the river.
          float flowPhase = imageUv.x * 118.0 + imageUv.y * 72.0
            + sin(imageUv.y * 27.0 + uTime * 0.72) * 1.7 - uTime * 3.0;
          float flowWave = 0.5 + 0.5 * sin(flowPhase);
          float streak = pow(max(0.0, flowWave), 11.0);
          float fineFlow = 0.5 + 0.5 * sin(imageUv.x * 230.0 + imageUv.y * 148.0 - uTime * 5.1);
          float sparkles = pow(max(0.0, fineFlow), 17.0);

          // Two overlapping ripple fields across the lake and the river mouth.
          float lakeDistance = length((imageUv - vec2(0.79, 0.47)) * vec2(1.22, 1.0));
          float lakeRipple = pow(max(0.0, 0.5 + 0.5 * sin(lakeDistance * 180.0 - uTime * 3.2)), 15.0);
          float riverDistance = length((imageUv - vec2(0.63, 0.67)) * vec2(1.0, 0.78));
          float riverRipple = pow(max(0.0, 0.5 + 0.5 * sin(riverDistance * 145.0 - uTime * 3.8)), 16.0);

          float riverAlpha = river * (0.035 + streak * 0.18 + sparkles * 0.12 + riverRipple * 0.075);
          float lakeAlpha = lake * (0.018 + sparkles * 0.075 + lakeRipple * 0.095);
          float alpha = clamp(riverAlpha + lakeAlpha, 0.0, 0.30);
          vec3 deep = vec3(0.025, 0.32, 0.44);
          vec3 glint = vec3(0.43, 0.96, 0.92);
          vec3 color = mix(deep, glint, clamp(streak * 0.66 + sparkles * 0.55 + lakeRipple * 0.35, 0.0, 1.0));
          color = mix(color, vec3(0.72, 0.99, 1.0), clamp(sparkles * 0.82 + riverRipple * 0.28, 0.0, 1.0));
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const geometry = new THREE.PlaneGeometry(2, 2, 180, 100);
    const waterSurface = new THREE.Mesh(geometry, material);
    scene.add(waterSurface);

    function resize() {
      const width = Math.max(1, hero.clientWidth);
      const height = Math.max(1, hero.clientHeight);
      renderer.setSize(width, height, false);
      // Match CSS background-size:cover and background-position used above.
      const imageAspect = 1855 / 776;
      const viewAspect = width / height;
      let visibleWidth = 1, visibleHeight = 1, startX = 0, startY = 0;
      if (imageAspect > viewAspect) {
        visibleWidth = viewAspect / imageAspect;
        const horizontalPosition = width <= 900 ? 0.70 : 0.50;
        startX = (1 - visibleWidth) * horizontalPosition;
      } else {
        visibleHeight = imageAspect / viewAspect;
        startY = (1 - visibleHeight) * 0.50;
      }
      uniforms.uCrop.value.set(startX, startY, visibleWidth, visibleHeight);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    let visible = true;
    let running = false;
    const clock = new THREE.Clock();
    function render() {
      if (!visible || document.hidden) { running = false; return; }
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      if (!reduceMotion) requestAnimationFrame(render);
      else running = false;
    }
    function start() {
      if (!running) { running = true; requestAnimationFrame(render); }
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }, { threshold: 0.02 });
      observer.observe(hero);
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) start();
    });
    start();
    canvas.dataset.ready = '1';
  }

  if (fallback) fallback.style.opacity = '0';
  startScene();
})();
