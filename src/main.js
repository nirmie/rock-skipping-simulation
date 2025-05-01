import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Water from './objects/water';
import Ground from './objects/ground';
import RockThrowController from './controllers/rockThrowController';
import { setupUI } from './ui';

// Animation
const clock = new THREE.Clock();
const waterResolution = 256;
const waterPlaneSize = { width: 2, height: 10 }; // Define size here to pass to Water

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.2; // Lowered exposure
renderer.shadowMap.enabled = true; // Enable shadow maps
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
document.body.appendChild(renderer.domElement);

// Environment map
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('/sunsetEnv/'); // Make sure this path is correct relative to your public folder
const environmentMapPromise = cubeTextureLoader.loadAsync([ // Use loadAsync
    'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
]);

// --- Water Object ---
// Initialize water variable, will be assigned after env map loads
let water;

// --- Ground Object ---
const ground = new Ground({ planeSize: waterPlaneSize }); // Pass size to ground
ground.receiveShadow = true; // Ground should receive shadows
scene.add(ground);

// --- Rock Throw Controller ---
let rockThrowController;

// --- Async Initialization ---
async function initializeScene() {
    try {
        const loadedEnvMap = await environmentMapPromise;
        scene.background = loadedEnvMap;
        scene.environment = loadedEnvMap;

        // Create Water *after* env map is loaded
        water = new Water({
            resolution: waterResolution,
            envMap: loadedEnvMap,
            planeSize: waterPlaneSize // Pass plane size
        });
        water.castShadow = true; // Water surface can cast shadows (optional, might be expensive)
        scene.add(water);

        // Initialize Rock Throw Controller after water is created
        rockThrowController = new RockThrowController({
            scene: scene,
            camera: camera,
            water: water,
            waterPlaneSize: waterPlaneSize,
            domElement: renderer.domElement,
            throwVelocity: 10.0
        });

        // Setup UI after water and ground are created (without rock controller)
        setupUI({ waterResolution, water, ground, rockThrowController });


        // Show instructions
        showInstructions();

        // Start animation loop only after everything is loaded
        animate();

    } catch (error) {
        console.error('Failed to initialize scene:', error);
        // Fallback background color if env map fails
        scene.background = new THREE.Color(0x87ceeb);
        // Optionally create water with null envMap or handle error differently
        water = new Water({
            resolution: waterResolution,
            envMap: null, // Or a default texture
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
            throwVelocity: 5.0
        });

        // Ensure ground is passed to setupUI even in error case if needed
        setupUI({ waterResolution, water, ground, rockThrowController });


        // Show instructions
        showInstructions();

        animate(); // Still start animation
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
    instructions.style.pointerEvents = 'none'; // Don't interfere with mouse events

    instructions.innerHTML = `
        <h3 style="margin: 0 0 10px 0">Rock Skipping Simulation</h3>
        <p style="margin: 5px 0">Move your mouse to aim at the water</p>
        <p style="margin: 5px 0">Press SPACEBAR to throw a rock</p>
        <p style="margin: 5px 0">Use mouse to rotate camera</p>
        <p style="margin: 5px 0">Scroll to zoom in/out</p>
    `;

    document.body.appendChild(instructions);
}

// Camera position
camera.position.set(0, 1.5, -6.8); // Adjusted camera for better view
// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1); // Point controls towards the water center
controls.enableDamping = true;

// Strong Directional Light (Sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // Lowered intensity
directionalLight.position.set(2, 5, 3); // Adjust position/direction
directionalLight.castShadow = true; // Enable shadow casting

// Configure shadow properties
directionalLight.shadow.mapSize.width = 1024; // Shadow map resolution
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 20;
// Adjust shadow camera frustum to cover the area of interest
directionalLight.shadow.camera.left = -waterPlaneSize.width;
directionalLight.shadow.camera.right = waterPlaneSize.width;
directionalLight.shadow.camera.top = waterPlaneSize.height;
directionalLight.shadow.camera.bottom = -waterPlaneSize.height;

scene.add(directionalLight);

let lastTime = 0;
const lightDirection = new THREE.Vector3(); // Reusable vector

function animate() {
    requestAnimationFrame(animate); // Request next frame first

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastTime;
    lastTime = elapsedTime;

    controls.update();

    // --- Simulation & Caustics Update ---
    if (water) { // Check if water exists
        // 1. Simulate water surface
        water.simulate(renderer, deltaTime);
        renderer.state.reset(); // Reset state after simulation render pass

        // 2. Update light direction for caustics
        // Get world direction of light
        lightDirection.copy(directionalLight.position).normalize();
        // If light has a target: lightDirection.subVectors(directionalLight.position, directionalLight.target.position).normalize();
        water.causticsMaterial.uniforms.uLightDirection.value.copy(lightDirection);

        // 3. Render caustics map based on simulation and light
        water.renderCaustics(renderer);
        renderer.state.reset(); // Reset state after caustics render pass

        // 4. Update water appearance (time, heightmap)
        water.update(elapsedTime);

        // 5. Update ground material with the generated caustics map
        if (ground) {
            ground.material.uniforms.uCausticsMap.value = water.getCausticsTexture();
        }
    }
    // --- End Simulation & Caustics Update ---

    if (ground) { // Check if ground exists
        ground.update(elapsedTime); // Update ground time uniform if needed
    }

    // Update rock throwing physics if controller exists
    if (rockThrowController) {
        rockThrowController.update(deltaTime);
    }

    renderer.render(scene, camera); // Render main scene
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Note: Render targets in Water class don't need resizing here
});

// Start initialization
initializeScene();