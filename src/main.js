import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Water from './objects/water';
import Ground from './objects/ground';
import { setupUI } from './ui';

// Animation
const clock = new THREE.Clock();
const waterResolution = 256;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.5;
document.body.appendChild(renderer.domElement);

// --- Raycasting Setup ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastClickTime = -Infinity; // Initialize to a very old time
let lastClickPosition = new THREE.Vector2(); // Initialize

// Environment map
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('/sunsetEnv/');
const environmentMap = cubeTextureLoader.loadAsync([
  'px.png', // positive x
  'nx.png', // negative x 
  'py.png', // positive y
  'ny.png', // negative y
  'pz.png', // positive z
  'nz.png'  // negative z
]);
environmentMap.catch(error => {
  console.error('Failed to load environment map:', error);
});

scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.environment = environmentMap;
environmentMap.then(texture => {
  scene.background = texture;
  scene.environment = texture;
}).catch(error => {
  console.error('Failed to load environment map:', error);
});

// Camera position
camera.position.set(0.5, 0.25, -1);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add some light to see the ground material
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const water = new Water({ resolution: waterResolution, envMap: environmentMap});
scene.add(water);

const ground = new Ground();
scene.add(ground);


function animate() {
  const elapsedTime = clock.getElapsedTime();
  controls.update();

  // Pass click data to water shader
  water.material.uniforms.uLastClickTime.value = lastClickTime;
  water.material.uniforms.uLastClickPosition.value.copy(lastClickPosition); // Use copy for Vector2

  water.update(elapsedTime);
  ground.update(elapsedTime);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('pointerdown', (event) => {
  // Calculate pointer position in normalized device coordinates (-1 to +1)
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, camera);

  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObject(water); // Check only against water

  if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      // Store the XZ coordinates and the time of the click
      lastClickPosition.set(intersectionPoint.x, intersectionPoint.z);
      lastClickTime = clock.getElapsedTime();
      console.log('Clicked water at:', intersectionPoint.x, intersectionPoint.z, 'Time:', lastClickTime);
  }
});

animate();
setupUI({ waterResolution, water, ground });