import * as THREE from 'three';
import vertexShader from '../shaders/water_vertex.glsl?raw';
import fragmentShader from '../shaders/water_fragment.glsl?raw';
// --- Import Simulation Shaders ---
import simulationVertexShader from '../shaders/simulation_vertex.glsl?raw';
import simulationFragmentShader from '../shaders/simulation_fragment.glsl?raw';
// --- Import Caustics Shaders ---
import causticsVertexShader from '../shaders/caustics_vertex.glsl?raw';
import causticsFragmentShader from '../shaders/caustics_fragment.glsl?raw';

export default class Water extends THREE.Mesh {
    constructor(options) {
        super();

        this.waterResolution = options.resolution;
        this.waterPlaneSize = options.planeSize || { width: 2, height: 2 }; // Default or passed size
        const aspectRatio = this.waterPlaneSize.width / this.waterPlaneSize.height; // Calculate aspect ratio

        // --- Simulation Setup ---
        this.simulationResolution = this.waterResolution;

        // Create Render Targets (Ping-Pong Buffers)
        this.renderTarget1 = new THREE.WebGLRenderTarget(this.simulationResolution, this.simulationResolution, {
            type: THREE.FloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });
        this.renderTarget2 = this.renderTarget1.clone();

        // Simulation Material
        this.simulationMaterial = new THREE.ShaderMaterial({
            vertexShader: simulationVertexShader,
            fragmentShader: simulationFragmentShader,
            uniforms: {
                tPrev: { value: this.renderTarget1.texture }, // Start reading from RT1
                uResolution: { value: new THREE.Vector2(this.simulationResolution, this.simulationResolution) },
                uDelta: { value: 0.0 },
                uViscosity: { value: 0.1 },
                uAspect: { value: aspectRatio },
                uApplyDisturbance: { value: false },
                uDisturbancePos: { value: new THREE.Vector2() },
                uDisturbanceAmount: { value: 1 },
                uDisturbanceIntensity: { value: 1 },
                uDisturbanceRadius: { value: 0.004 },
            }
        });

        // Simulation Scene and Camera
        this.simulationScene = new THREE.Scene();
        this.simulationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.simulationQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.simulationMaterial
        );
        this.simulationScene.add(this.simulationQuad);

        this.disturbanceQueue = []; // Queue for click/collision disturbances
        // --- End Simulation Setup ---

        // --- Caustics Setup ---
        this.causticsResolution = this.waterResolution * 2; // Caustics can be higher res if needed
        this.causticsRenderTarget = new THREE.WebGLRenderTarget(this.causticsResolution, this.causticsResolution, {
            type: THREE.HalfFloatType, // Use HalfFloat for better precision if needed, or FloatType
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat, // Or just RedFormat if only storing intensity
            stencilBuffer: false
        });

        this.causticsMaterial = new THREE.ShaderMaterial({
            vertexShader: causticsVertexShader,
            fragmentShader: causticsFragmentShader,
            uniforms: {
                uHeightMap: { value: null }, // Will be set in renderCaustics
                uResolution: { value: new THREE.Vector2(this.simulationResolution, this.simulationResolution) }, // Resolution of heightmap
                uCausticsResolution: { value: new THREE.Vector2(this.causticsResolution, this.causticsResolution) },
                uLightDirection: { value: new THREE.Vector3(0.5, -1.0, 0.5).normalize() }, // Example light direction
                uWaterDepth: { value: 0.5 }, // Virtual depth for refraction calculation
                uIntensity: { value: 1.5 }, // Caustics brightness
            },
            transparent: true,
        });

        this.causticsScene = new THREE.Scene();
        this.causticsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.causticsQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.causticsMaterial
        );
        this.causticsScene.add(this.causticsQuad);
        // --- End Caustics Setup ---

        // --- Main Water Material ---
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uEnvironmentMap: { value: options.envMap },
                uTroughColor: { value: new THREE.Color('#186691') },
                uSurfaceColor: { value: new THREE.Color('#9bd8c0') },
                uCrestColor: { value: new THREE.Color('#bbd8e0') },
                uOpacity: { value: 0.8 },
                uTime: { value: 0 },
                uTroughThreshold: { value: -0.01 },
                uTroughTransition: { value: 0.15 },
                uCrestThreshold: { value: 0.08 },
                uCrestTransition: { value: 0.05 },
                uFresnelStrength: { value: 0.8 },
                uFresnelPower: { value: 0.5 },
                uHeightMap: { value: this.renderTarget2.texture }, // Start rendering water using RT2
                uHeightScale: { value: 0.2 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
        });

        // --- Geometry ---
        this.geometry = new THREE.PlaneGeometry(
            this.waterPlaneSize.width,
            this.waterPlaneSize.height,
            options.resolution,
            options.resolution
        );
        this.rotation.x = -Math.PI / 2;
        // this.position.z = this.waterPlaneSize.height / 2; // Adjust position based on size if needed
    }

    // --- Add Disturbance to Simulation ---
    addDisturbance(uvPosition, amount) {
        // Clamp UVs just in case
        const clampedUvX = Math.max(0.0, Math.min(1.0, uvPosition.x));
        const clampedUvY = Math.max(0.0, Math.min(1.0, uvPosition.y));
        this.disturbanceQueue.push({
            position: new THREE.Vector2(clampedUvX, clampedUvY),
            amount: amount
        });
    }

    // --- Simulation Update Step ---
    simulate(renderer, deltaTime) {
        // Ensure renderer is available
        if (!renderer) {
            console.error("Renderer not provided to simulate function.");
            return;
        }

        const currentRenderTarget = renderer.getRenderTarget(); // Store current target
        const currentXrEnabled = renderer.xr.enabled;
        const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

        // Temporarily disable xr and shadow map updates for performance
        renderer.xr.enabled = false;
        renderer.shadowMap.autoUpdate = false;

        // --- Simulation Pass ---
        renderer.setRenderTarget(this.renderTarget2); // Render simulation to RT2
        this.simulationMaterial.uniforms.tPrev.value = this.renderTarget1.texture; // Read from RT1
        this.simulationMaterial.uniforms.uDelta.value = Math.min(deltaTime, 1 / 60) * 8.0; // Clamp delta, adjust speed multiplier

        // Process one disturbance from the queue
        if (this.disturbanceQueue.length > 0) {
            const disturbance = this.disturbanceQueue.shift();
            this.simulationMaterial.uniforms.uApplyDisturbance.value = true;
            this.simulationMaterial.uniforms.uDisturbancePos.value.copy(disturbance.position);
            // Use the disturbance intensity from the rock without overriding the global amount
            this.simulationMaterial.uniforms.uDisturbanceIntensity.value = disturbance.amount;
        } else {
            this.simulationMaterial.uniforms.uApplyDisturbance.value = false;
        }

        renderer.clear(); // Clear the target before rendering
        renderer.render(this.simulationScene, this.simulationCamera);
        // --- End Simulation Pass ---

        // Swap Render Targets for next frame
        [this.renderTarget1, this.renderTarget2] = [this.renderTarget2, this.renderTarget1];

        // Update water material to use the *newly rendered* texture
        this.material.uniforms.uHeightMap.value = this.renderTarget2.texture; // Water reads from RT2 now

        // Restore previous renderer state
        renderer.setRenderTarget(currentRenderTarget);
        renderer.xr.enabled = currentXrEnabled;
        renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    }

    // --- Caustics Rendering Step ---
    renderCaustics(renderer) {
        if (!renderer) {
            console.error("Renderer not provided to renderCaustics function.");
            return;
        }

        const currentRenderTarget = renderer.getRenderTarget();
        const currentXrEnabled = renderer.xr.enabled;
        const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

        renderer.xr.enabled = false;
        renderer.shadowMap.autoUpdate = false;

        // --- Caustics Pass ---
        renderer.setRenderTarget(this.causticsRenderTarget);
        // Use the *latest* height map from the simulation (which is now in RT2 after the swap)
        this.causticsMaterial.uniforms.uHeightMap.value = this.renderTarget2.texture;
        // Update light direction if it's dynamic
        // this.causticsMaterial.uniforms.uLightDirection.value = ...;

        renderer.clear(); // Important: Clear the caustics target
        renderer.render(this.causticsScene, this.causticsCamera);
        // --- End Caustics Pass ---

        // Restore previous renderer state
        renderer.setRenderTarget(currentRenderTarget);
        renderer.xr.enabled = currentXrEnabled;
        renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    }

    // --- General Update (e.g., for time uniform) ---
    update(time) {
        this.material.uniforms.uTime.value = time;
        // Note: Simulation is handled by simulate() method
    }

    // --- Expose Caustics Texture ---
    getCausticsTexture() {
        return this.causticsRenderTarget.texture;
    }
}