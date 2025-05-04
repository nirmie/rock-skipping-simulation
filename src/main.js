import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Water from './objects/water';
import Ground from './objects/ground';
import RockThrowController from './controllers/rockThrowController';
import { setupUI } from './ui';
import { Vector2Uniform } from 'three/src/renderers/common/Uniform.js';
import { Wireframe } from 'three/examples/jsm/Addons.js';

/* Gravity, size, weight, all should be in real world units M
 water disturbance should be affected by velocity and mass (force)
 angular velocity should increase probability of skipping
 velocity should be affected by skipping angle (flatter skip, less velocity loss)
*/

// Animation setup: Create a clock to track time and set up water resolution and plane size
const clock = new THREE.Clock();
const waterResolution = 512;
const waterPlaneSize = { width: 10, height: 25 };

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
document.body.appendChild(renderer.domElement);

// Environment map setup: Load the environment map to be used for lighting and reflections
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('/sunsetEnv/');
const environmentMapPromise = cubeTextureLoader.loadAsync([
    'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
]);

// --- Water Object ---
let water;

// --- Ground Object ---
const ground = new Ground({ planeSize: waterPlaneSize });
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
            Wireframe: true
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
            skipAngleThreshold: 45,
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
            planeSize: waterPlaneSize
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
            skipAngleThreshold: 45,
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
            <li>Left Click to rotate camera</li>
            <li>Scroll to zoom in/out</li>
            <li>Right Click to pan around</li>
        </ul>
    `;

    document.body.appendChild(instructions);
}

// Set up camera position and controls
camera.position.set(0, 1.5, -(waterPlaneSize.height || 10) / 2 - 2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1);
controls.enableDamping = true;

// Set up lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-5, 3, -3);
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
const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
scene.add(shadowHelper);

let lastTime = 0;
const lightDirection = new THREE.Vector3();

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastTime;
    lastTime = elapsedTime;

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