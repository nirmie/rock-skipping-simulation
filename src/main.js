import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { setupUI } from './ui';

// Animation
const clock = new THREE.Clock();

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.5;
document.body.appendChild(renderer.domElement);

// Environment map
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('/');
const environmentMap = cubeTextureLoader.loadAsync([
  'px.png', // positive x
  'nx.png', // negative x 
  'py.png', // positive y
  'ny.png', // negative y
  'pz.png', // positive z
  'nz.png'  // negative z
]);

const poolTexture = new THREE.TextureLoader().loadAsync('/threejs-water-shader/ocean_floor.png');

scene.background = environmentMap;
scene.environment = environmentMap;

// Camera position
camera.position.set(0.5, 0.25, -1);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add some light to see the ground material
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

function animate() {
  const elapsedTime = clock.getElapsedTime();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
setupUI({ waterResolution, water, ground });