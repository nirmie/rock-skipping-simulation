import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Corrected import path
import Water from './objects/water';
import Ground from './objects/ground';
import { setupUI } from './ui';

// Animation
const clock = new THREE.Clock();
const waterResolution = 256;
const waterPlaneSize = { width: 2, height: 2 }; // Define size here to pass to Water

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.5;
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
            // heightMap is now handled internally by Water class
        });
        scene.add(water);

        // Setup UI after water is created
        setupUI({ waterResolution, water, ground }); // Pass water instance

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
        setupUI({ waterResolution, water, ground });
        animate(); // Still start animation maybe?
    }
}


// Camera position
camera.position.set(0.5, 1.5, -2); // Adjusted camera for better view potentially

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 5); // Point controls towards the water center
controls.enableDamping = true;

// Add some light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);


let lastTime = 0;

function animate() {
    requestAnimationFrame(animate); // Request next frame first

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastTime;
    lastTime = elapsedTime;

    controls.update();

    // --- Simulation Update ---
    if (water) { // Check if water exists
        water.simulate(renderer, deltaTime); // Call the water's simulate method
        renderer.state.reset();
        water.update(elapsedTime); // Call the water's general update method

    }
    // --- End Simulation Update ---

    if (ground) { // Check if ground exists
        ground.update(elapsedTime);

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