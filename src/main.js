import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Water from './objects/water';
import Ground from './objects/ground';
import RockThrowController from './controllers/rockThrowController';
import { setupUI } from './ui';

/* Gravity, size, weight, all should be in real world units M
 water disturbance should be affected by velocity and mass (force)
 angular velocity should increase probability of skipping
 velocity should be affected by skipping angle (flatter skip, less velocity loss)
*/

// Animation setup: Create a clock to track time and set up water resolution and plane size
const clock = new THREE.Clock();
const waterResolution = 384;
const waterPlaneSize = { width: 4, height: 20 };
const floorDepth = -2;

// Track which keys are currently pressed
const keyState = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false
};

// Camera movement speed
const cameraSpeed = 3.0; // units per second

// Scene setup: Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Fixed: Use window.devicePixelRatio
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Make sure the canvas fills the viewport with no margin or padding
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';
renderer.domElement.style.margin = '0';
renderer.domElement.style.padding = '0';
document.body.appendChild(renderer.domElement);

// Environment map setup: Load the environment map to be used for lighting and reflections
const cubeTextureLoader = new THREE.CubeTextureLoader();
// cubeTextureLoader.setPath('/');
// const environmentMapPromise = cubeTextureLoader.loadAsync('sky.hdr')
// cubeTextureLoader.setPath('/water_scene/');
// const environmentMapPromise = cubeTextureLoader.loadAsync([ 'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']);
cubeTextureLoader.setPath('/sunsetEnv/');
 const environmentMapPromise = cubeTextureLoader.loadAsync([ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

// Set up camera position and controls
camera.position.set(0, 1.5, -(waterPlaneSize.height || 10) / 2 - 2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1);
controls.enableDamping = true;

// Set up keyboard controls for camera movement
window.addEventListener('keydown', (event) => {
  switch(event.key.toLowerCase()) {
    case 'w': keyState.w = true; break;
    case 'a': keyState.a = true; break;
    case 's': keyState.s = true; break;
    case 'd': keyState.d = true; break;
    case 'q': keyState.q = true; break;
    case 'e': keyState.e = true; break;
  }
});

window.addEventListener('keyup', (event) => {
  switch(event.key.toLowerCase()) {
    case 'w': keyState.w = false; break;
    case 'a': keyState.a = false; break;
    case 's': keyState.s = false; break;
    case 'd': keyState.d = false; break;
    case 'q': keyState.q = false; break;
    case 'e': keyState.e = false; break;
  }
});

// Set up lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-10, 1.8, 0);
directionalLight.castShadow = true;

directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -waterPlaneSize.width;
directionalLight.shadow.camera.right = waterPlaneSize.width;
directionalLight.shadow.camera.top = waterPlaneSize.height;
directionalLight.shadow.camera.bottom = -waterPlaneSize.height;

scene.add(directionalLight);

// Optional: Add a helper to visualize the shadow camera
// const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
// scene.add(shadowHelper);

const lightDirection = new THREE.Vector3();
lightDirection.copy(directionalLight.position).normalize();

// --- Water Object ---
let water;

// --- Ground Object ---
const ground = new Ground({ planeSize: waterPlaneSize, floorDepth: floorDepth });
ground.receiveShadow = true;
scene.add(ground);

// --- Rock Throw Controller ---
let rockThrowController;

// --- Async Initialization ---
async function initializeScene() {
    try {
        // Load the environment map and set it as the scene background and environment
        const loadedEnvMap = await environmentMapPromise;
        scene.background = loadedEnvMap;
        scene.environment = loadedEnvMap;

        // Create the water object after the environment map is loaded
        water = new Water({
            resolution: waterResolution,
            envMap: loadedEnvMap,
            planeSize: waterPlaneSize,
            floorDepth: floorDepth,
            lightDirection: lightDirection,
        });
        water.castShadow = true;
        scene.add(water);

        // Initialize the rock throw controller after the water object is created
        rockThrowController = new RockThrowController({
            scene: scene,
            camera: camera,
            water: water,
            waterPlaneSize: waterPlaneSize,
            domElement: renderer.domElement,
            throwVelocity: 10.0,
            skipAngleThreshold: 17,
            floorDepth: floorDepth,
            envMap: loadedEnvMap,
        });

        // Setup the UI after the water and ground objects are created
        setupUI({ waterResolution, water, ground, rockThrowController });
        showInstructions();
        animate();

    } catch (error) {
        console.error('Failed to initialize scene:', error);
        // Fallback background color if env map fails
        scene.background = new THREE.Color(0x87ceeb); // sky blue
        // Optionally create water with null envMap or handle error differently
        water = new Water({
            resolution: waterResolution,
            envMap: null,
            planeSize: waterPlaneSize,
            floorDepth: floorDepth,
            lightDirection: lightDirection,
        });
        scene.add(water);

        // Initialize Rock Throw Controller with fallback
        rockThrowController = new RockThrowController({
            scene: scene,
            camera: camera,
            water: water,
            waterPlaneSize: waterPlaneSize,
            domElement: renderer.domElement,
            throwVelocity: 10.0,
            skipAngleThreshold: 17,
            floorDepth: floorDepth,
        });

        // still setup UI even though some wont be functional
        setupUI({ waterResolution, water, ground, rockThrowController });
        showInstructions();
        animate();
    }
}

// Display instructions for the user
function showInstructions() {
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.top = '20px';
    instructions.style.left = '20px';
    instructions.style.color = 'white';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    instructions.style.padding = '10px';
    instructions.style.borderRadius = '5px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.fontSize = '14px';
    instructions.style.pointerEvents = 'none';

    instructions.innerHTML = `
        <h3 style="margin: 0 0 10px 0; text-align: center;">Rock Skipping Simulation</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li>Move your mouse to aim at the water</li>
            <li>Press SPACEBAR to throw a rock</li>
            <li>Use WASD keys to move camera on the XZ plane</li>
            <li>Use Q/E keys to move camera up/down</li>
            <li>Left Click to rotate camera</li>
            <li>Scroll to zoom in/out</li>
            <li>Right Click to pan around</li>
        </ul>
    `;

    document.body.appendChild(instructions);
}

let lastTime = 0;

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastTime;
    lastTime = elapsedTime;

    // Handle keyboard camera movement
    const moveDirection = new THREE.Vector3(0, 0, 0);

    // XZ-plane movement (world coordinates)
    if (keyState.w) moveDirection.z += 1; // Forward in world space
    if (keyState.s) moveDirection.z -= 1; // Backward in world space
    if (keyState.a) moveDirection.x += 1; // Left in world space
    if (keyState.d) moveDirection.x -= 1; // Right in world space

    // Vertical movement
    if (keyState.q) moveDirection.y -= 1; // Down
    if (keyState.e) moveDirection.y += 1; // Up

    // Apply movement if any keys are pressed
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        const moveDist = cameraSpeed * deltaTime;
        moveDirection.multiplyScalar(moveDist);

        // Move the camera
        camera.position.add(moveDirection);

        // Move the orbit controls target to match camera movement
        controls.target.add(moveDirection);
    }

    controls.update();

    // --- Simulation & Caustics Update ---
    if (water) { // Check if water exists
        // 1. Simulate water surface
        water.simulate(renderer, deltaTime);
        renderer.state.reset();

        // 2. Update light direction for caustics
        // Get world direction of light
        lightDirection.copy(directionalLight.position).normalize();
        water.causticsMaterial.uniforms.uLightDirection.value.copy(lightDirection);

        // 3. Render caustics map based on simulation and light
        water.renderCaustics(renderer);
        renderer.state.reset();

        water.update(elapsedTime);

        if (ground) {
            ground.material.uniforms.uCausticsMap.value = water.getCausticsTexture();
        }
    }

    if (ground) {
        ground.update(elapsedTime);
    }

    if (rockThrowController) {
        rockThrowController.update(deltaTime);
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer size to match window exactly
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    // Update water resolution if needed
    if (water && water.updateResolution) {
        water.updateResolution();
    }
});

// Initialize the scene
initializeScene();