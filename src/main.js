import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Corrected import path
import Water from './objects/water';
import Ground from './objects/ground';
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

// Raycasting Setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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

        // Setup UI after water and ground are created
        setupUI({ waterResolution, water, ground }); // Pass both instances

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
        // Ensure ground is passed to setupUI even in error case if needed
        setupUI({ waterResolution, water, ground });
        animate(); // Still start animation maybe?
    }
}


// Camera position
camera.position.set(0, 1.5, -2); // Adjusted camera for better view potentially
// camera.position.set(0, 0, 0);
// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1); // Point controls towards the water center
controls.enableDamping = true;

// // --- Lights --- 
// // Remove or reduce ambient light if directional is strong
// scene.remove(scene.getObjectOfType(THREE.AmbientLight)); // Remove previous ambient light
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Lower intensity ambient
// scene.add(ambientLight);

// Strong Directional Light (Sun)
// scene.remove(scene.getObjectOfType(THREE.DirectionalLight)); // Remove previous directional light
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
// Optional: Add a helper to visualize the shadow camera
// const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
// scene.add(shadowHelper);
// --- End Lights ---


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

    renderer.render(scene, camera); // Render main scene
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Note: Render targets in Water class don't need resizing here
});

// Click Event Listener - Updated to call water.addDisturbance
window.addEventListener('pointerdown', (event) => {
    if (!water) return; // Don't raycast if water isn't loaded yet

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(water); // Raycast against the water mesh

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const uv = intersects[0].uv; // Use the UV coordinates from the intersection

        // Check if UV exists (it should for PlaneGeometry)
        if (uv) {
            // Add disturbance using the UV coordinates directly
            water.addDisturbance(uv, 0.2); // Adjust intensity (0.2) as needed
            console.log('Adding disturbance at UV:', uv.x, uv.y);
        } else {
            // Fallback: Convert world XZ to UV (less accurate if plane isn't perfectly aligned)
            const uvX = (intersectionPoint.x / waterPlaneSize.width) + 0.5;
            const uvY = (intersectionPoint.z / waterPlaneSize.height) + 0.5; // Z maps to V
            water.addDisturbance(new THREE.Vector2(uvX, uvY), 0.2);
            console.log('Adding disturbance via fallback UV calculation:', uvX, uvY);
        }
    }
});

// --- Start Initialization ---
initializeScene();