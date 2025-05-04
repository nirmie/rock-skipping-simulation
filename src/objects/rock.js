import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const rockTypesPaths = {
    cracked_boulder: 'rock_textures/cracked_boulder/cracked_boulder',
    coast: 'rock_textures/coast/coast',
    sandstone: 'rock_textures/coast/coast',
    // slate: 'rock_textures/slate'
};

const rockTypes = {
    cracked_boulder: {
        // name: 'Cracked Boulder',
        diffuse: new THREE.TextureLoader().load(`${rockTypesPaths.cracked_boulder}_diff.jpg`),
        displacement: new THREE.TextureLoader().load(`${rockTypesPaths.cracked_boulder}_disp.png`),
        normal: null // Will be loaded async
    },
    coast: {
        // name: 'Coast',
        diffuse: new THREE.TextureLoader().load(`${rockTypesPaths.coast}_diff.jpg`),
        displacement: new THREE.TextureLoader().load(`${rockTypesPaths.coast}_disp.png`),
        normal: null
    },
    // slate: {
    //   diffuse: new THREE.TextureLoader().load(`${rockTypesPaths.slate}_diffuse.jpg`),
    //   displacement: new THREE.TextureLoader().load(`${rockTypesPaths.slate}_disp.png`),
    //   normal: null
    // }
};

// Configure all textures
Object.keys(rockTypes).forEach(rockType => {
    const textures = rockTypes[rockType];
    const basePath = rockTypesPaths[rockType];

    // Configure diffuse texture
    textures.diffuse.wrapS = THREE.RepeatWrapping;
    textures.diffuse.wrapT = THREE.RepeatWrapping;

    // Configure displacement texture
    textures.displacement.wrapS = THREE.RepeatWrapping;
    textures.displacement.wrapT = THREE.RepeatWrapping;

    // Load normal map
    const exrLoader = new EXRLoader();
    console.log(`${basePath}_nor_gl.exr`);
    exrLoader.load(`${basePath}_nor_gl.exr`, (texture) => {
        textures.normal = texture;
        textures.normal.wrapS = THREE.RepeatWrapping;
        textures.normal.wrapT = THREE.RepeatWrapping;
    });
});

var activeRockType = 'cracked_boulder';

function setActiveRockType(newType) {
    activeRockType = newType;
}

export { rockTypes, activeRockType, setActiveRockType };


export default class Rock {
    constructor(options = {}) {
        // Default options
        this.options = {
            radius: options.radius || 0.05,
            segments: options.segments || 12,
            mass: options.mass || 0.1, // kg
            dragCoefficient: options.dragCoefficient || 0.2,
            elasticity: options.elasticity || 0.6, // Bounce factor
            minSkipVelocity: options.minSkipVelocity || 0.8, // Min velocity needed to skip
            waterPlaneSize: options.waterPlaneSize || { width: 2, height: 2 },
            skipsBeforeSink: options.skipsBeforeSink || 5, // Maximum skips before sinking
            skipAngleThreshold: options.skipAngleThreshold || 30, // Angle threshold for skipping converted to radians
            floorDepth: options.floorDepth || -0.5,

            rockType: options.rockType || activeRockType, // Use the current active rock type
            displacementScale: options.displacementScale || 0.05,
            textureRepeat: options.textureRepeat || new THREE.Vector2(2, 2),
            envMap: options.envMap || null // Environment map for reflections
        };

        // Physics properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        // REDUCED: Lower gravity for longer trajectories
        this.gravity = new THREE.Vector3(0, -9.8, 0); // Half of normal gravity
        this.isActive = false;
        this.skipCount = 0;
        this.hasSunk = false;
        this.lastCollisionPoint = null;
        this.initialVelocity = new THREE.Vector3(0, 0, 0); // Store initial velocity for logging
        this.startTime = 0;

        // Create the rock geometry and mesh
        this.createMesh();
    }

    createMesh() {
        // Create a slightly deformed sphere for the rock
        const geometry = new THREE.SphereGeometry(
            this.options.radius,
            this.options.segments * 2,
            this.options.segments * 2
        );

        // Deform vertices
        const positions = geometry.attributes.position;
        // for (let i = 0; i < positions.count; i++) {
        //     const vertex = new THREE.Vector3();
        //     vertex.fromBufferAttribute(positions, i);

        //     // Apply random deformation
        //     const noise = (Math.random() - 0.5) * 0.3;
        //     vertex.multiplyScalar(1 + noise * this.options.radius);

        //     // Update the vertex
        //     positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        // }

        // Update normals and compute tangents for normal mapping
        geometry.computeVertexNormals();
        geometry.computeTangents();

        // Get the textures for the current rock type
        console.log("Rock type:", this.options.rockType);
        console.log("Available rock types:", Object.keys(rockTypes));

        const textures = rockTypes[this.options.rockType];
        console.log("Textures object:", textures);

        // Create a fallback material in case textures aren't loaded
        let material;

        if (!textures || !textures.diffuse) {
            console.error("Textures not found for rock type:", this.options.rockType);
            // Create a fallback material
            material = new THREE.MeshStandardMaterial({
                color: 0x7a7a7a,
                roughness: 0.8,
                metalness: 0.1,
                envMap: this.options.envMap,
                envMapIntensity: 0.3
            });
        } else {
            // Create material with texture
            material = new THREE.MeshStandardMaterial({
                map: textures.diffuse,
                displacementMap: textures.displacement || null,
                displacementScale: this.options.displacementScale,
                normalMap: textures.normal || null, // Might be null initially
                roughness: 0.8,
                metalness: 0.2,
                envMap: this.options.envMap, // Use environment map for reflections
                envMapIntensity: 0.3, // Lower intensity for subtle reflections
            });

            // Apply texture repeat
            if (textures.diffuse && textures.diffuse.repeat) {
                textures.diffuse.repeat.copy(this.options.textureRepeat);
            }
            if (textures.displacement && textures.displacement.repeat) {
                textures.displacement.repeat.copy(this.options.textureRepeat);
            }
            if (textures.normal && textures.normal.repeat) {
                textures.normal.repeat.copy(this.options.textureRepeat);
            }
        }

        // Create the mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Initialize position
        this.mesh.position.copy(this.position);

        // Set up a callback to update the normal map when it's loaded
        if (textures && !textures.normal) {
            const checkNormalMap = () => {
                if (textures.normal) {
                    this.mesh.material.normalMap = textures.normal;
                    this.mesh.material.needsUpdate = true;
                } else {
                    setTimeout(checkNormalMap, 100);
                }
            };
            setTimeout(checkNormalMap, 100);
        }
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.mesh.position.copy(this.position);
    }

    setVelocity(vx, vy, vz) {
        this.velocity.set(vx, vy, vz);
        // Store the initial velocity for logging
        this.initialVelocity.copy(this.velocity);
        // console.log(`Rock initial velocity: (${vx.toFixed(2)}, ${vy.toFixed(2)}, ${vz.toFixed(2)}) - Magnitude: ${this.velocity.length().toFixed(2)}`);

        this.isActive = true;
        this.hasSunk = false;
        this.skipCount = 0;
        this.startTime = Date.now();
    }

    reset() {
        this.velocity.set(0, 0, 0);
        this.initialVelocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.position.set(0, 0, 0);
        this.mesh.position.copy(this.position);
        this.rotation.set(0, 0, 0);
        this.mesh.rotation.copy(this.rotation);
        this.isActive = false;
        this.hasSunk = false;
        this.skipCount = 0;
        this.lastCollisionPoint = null;
        this.startTime = 0;
    }

    update(deltaTime, waterHeight = 0, water) {
        if (!this.isActive) return; // Allow update even if sunk to apply sinking drag/stop

        const fixedDeltaTime = Math.min(deltaTime, 1 / 30);
        const prevPosition = this.position.clone();

        if (!this.hasSunk) {
            // Apply gravity and air drag if not sunk
            this.velocity.add(this.gravity.clone().multiplyScalar(fixedDeltaTime));
            const airDragForce = this.velocity.clone().normalize().multiplyScalar(
                -0.1 * this.options.dragCoefficient * this.velocity.lengthSq() * fixedDeltaTime
            );
            this.velocity.add(airDragForce.divideScalar(this.options.mass));

        } else {
            // Rock has sunk - apply sinking physics or check ground collision
            // Check if the rock is at or below ground level
            if (this.position.y <= this.options.floorDepth + 0.3) {
                // Already hit the ground in a previous frame or just hit it
                this.position.y = this.options.floorDepth + 0.3;    // Clamp position to ground level
                this.velocity.set(0, 0, 0);       // Stop ALL movement
                this.angularVelocity.set(0, 0, 0); // Stop spinning
                // Optionally deactivate completely after stopping
                // this.isActive = false;

            } else {
                // Still sinking towards the ground, apply sinking drag
                const sinkingDragCoefficient = 2.0;
                const sinkingDragForce = this.velocity.clone().multiplyScalar(
                    -sinkingDragCoefficient * fixedDeltaTime
                );
                this.velocity.add(sinkingDragForce);

                // Optional: Add slight upward buoyancy or just let gravity be countered by drag
                // this.velocity.y += 0.5 * fixedDeltaTime; // Example buoyancy

                // Stop sinking if velocity becomes very low (might happen before hitting ground)
                if (this.velocity.lengthSq() < 0.001) {
                    this.velocity.set(0, 0, 0);
                    this.angularVelocity.set(0, 0, 0);
                }
            }
        }

        // Update position based on velocity (only if velocity is not zero)
        if (this.velocity.lengthSq() > 0) {
            this.position.add(this.velocity.clone().multiplyScalar(fixedDeltaTime));
        }


        // Re-check if the new position went below ground level after position update
        if (this.hasSunk) {
            if (this.position.y < this.options.floorDepth + 0.3) {
                this.position.y = this.options.floorDepth + 0.3;    // Clamp position
                this.velocity.set(0, 0, 0);       // Ensure velocity is zeroed if it crossed the boundary
                this.angularVelocity.set(0, 0, 0);
            }
        }


        // Update rotation based on angular velocity (only if velocity/angular velocity is not zero)
        if (this.angularVelocity.lengthSq() > 0.001) {
            const rotationDelta = this.angularVelocity.clone().multiplyScalar(fixedDeltaTime);
            this.rotation.x += rotationDelta.x;
            this.rotation.y += rotationDelta.y;
            this.rotation.z += rotationDelta.z;
        }

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);

        // Check for water collision only if not already sunk
        if (!this.hasSunk) {
            this.checkWaterCollision(prevPosition, waterHeight, water, fixedDeltaTime);
        }

        // Check for boundaries (no changes needed here)
        this.checkBoundaries();
    }

    checkWaterCollision(prevPosition, waterHeight, water, deltaTime) {
        // Simple water collision: check if we crossed the water plane from above
        if (prevPosition.y >= waterHeight && this.position.y < waterHeight) {
            // Calculate precise collision point
            const t = (waterHeight - prevPosition.y) / (this.position.y - prevPosition.y);
            const collisionPoint = prevPosition.clone().lerp(this.position, t);

            // Store this collision point
            this.lastCollisionPoint = collisionPoint.clone();

            // Calculate collision impact velocity
            const impactVelocity = this.velocity.length();

            // calculating angle of incidence with water
            const waterNormal = new THREE.Vector3(0, 1, 0); // Normal of the water surface
            const velocityDirection = this.velocity.clone().normalize();
            // since angle from acos is just normal to velocity, we subtract it from PI/2
            const angleOfIncidence = Math.abs(Math.PI / 2 - Math.acos(velocityDirection.dot(waterNormal)));


            // Debug log the collision with velocity details
            // console.log(`Rock collision at (${collisionPoint.x.toFixed(2)}, ${collisionPoint.y.toFixed(2)}, ${collisionPoint.z.toFixed(2)})`);
            // console.log(`Impact velocity: ${impactVelocity.toFixed(2)} - Components: (${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}, ${this.velocity.z.toFixed(2)})`);
            const disturbanceIntensity = 0.01 + Math.pow(impactVelocity, 2.5) * this.options.radius * this.options.radius;

            console.log('Angle of incidence:', (180 / Math.PI) * angleOfIncidence.toFixed(2), ' Max angle:', this.options.skipAngleThreshold);
            // Only skip if velocity is above minimum threshold and we haven't exceeded max skips
            if (angleOfIncidence < (Math.PI / 180) * this.options.skipAngleThreshold && impactVelocity > this.options.minSkipVelocity && this.skipCount < this.options.skipsBeforeSink) {
                // Increment skip counter
                this.skipCount++;
                // console.log(`Skip #${this.skipCount}`);

                // Calculate bounce effect - we want the rock to lose some energy but maintain forward momentum
                const bounceCoefficient = this.options.elasticity * (1 - (this.skipCount / this.options.skipsBeforeSink));

                // Reflect velocity vector but maintain some forward momentum
                this.velocity.y = -this.velocity.y * bounceCoefficient;

                // REDUCED: Less speed loss on skip for longer trajectories
                this.velocity.x *= 0.95; // Was 0.9
                this.velocity.z *= 0.95; // Was 0.9

                // Log post-bounce velocity
                // console.log(`Post-bounce velocity: ${this.velocity.length().toFixed(2)} - Components: (${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}, ${this.velocity.z.toFixed(2)})`);

                // Apply random spin/rotation on collision
                this.angularVelocity.set(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                );

                // Intensity based on impact velocity and rock size


                // Create water disturbance at collision point
                if (water) {
                    // Calculate UV position from world position
                    const uvX = (collisionPoint.x / this.options.waterPlaneSize.width) + 0.5;
                    // Fixed negative Z for correct UV mapping
                    const uvY = (-collisionPoint.z / this.options.waterPlaneSize.height) + 0.5;



                    // Add disturbance to water
                    water.addDisturbance(new THREE.Vector2(uvX, uvY), water.simulationMaterial.uniforms.uDisturbanceAmount.value * disturbanceIntensity);
                    console.log(`Creating ripple at UV (${uvX.toFixed(2)}, ${uvY.toFixed(2)}) with intensity ${disturbanceIntensity.toFixed(3)}`);
                }
            } else {
                let sinkReason = "";
                if (impactVelocity <= this.options.minSkipVelocity) {
                    sinkReason = "insufficient velocity";
                } else if (Math.abs(angleOfIncidence) >= this.options.skipAngleThreshold * (Math.PI / 180)) {
                    sinkReason = "angle too steep";
                } else {
                    sinkReason = "max skips exceeded";
                }
                // Rock has sunk
                this.hasSunk = true;
                console.log(`Rock has sunk due to ${sinkReason}`);

                // Create final splash disturbance
                if (water) {
                    const uvX = (collisionPoint.x / this.options.waterPlaneSize.width) + 0.5;
                    // Fixed negative Z for correct UV mapping
                    const uvY = (-collisionPoint.z / this.options.waterPlaneSize.height) + 0.5;

                    // Slightly bigger disturbance for sinking
                    water.addDisturbance(new THREE.Vector2(uvX, uvY), water.simulationMaterial.uniforms.uDisturbanceAmount.value * disturbanceIntensity);
                    console.log(`Rock sinking at UV (${uvX.toFixed(2)}, ${uvY.toFixed(2)})`);
                }

                // Gradually sink the rock
                // this.velocity.set(this.velocity * 0.5); // Slow sinking velocity
                this.position.copy(collisionPoint);
                this.mesh.position.copy(this.position);
            }
        }
    }

    checkBoundaries() {
        // Check if rock has gone out of bounds
        const halfWidth = this.options.waterPlaneSize.width / 2;
        const halfHeight = this.options.waterPlaneSize.height / 2;
        if (
            this.position.x < -halfWidth ||
            this.position.x > halfWidth ||
            this.position.z < -halfHeight ||
            this.position.z > halfHeight ||
            this.position.y < this.options.floorDepth + 0.1 || // Only deactivate if it's significantly below ground (error margin)
            Date.now() - this.startTime > 3000 // Maximum simulation time (3 seconds)
        ) {
            // console.log(`Rock out of bounds or timeout. Position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
            this.isActive = false;
        }
    }

    // Returns if the rock is currently being simulated
    isSimulating() {
        return this.isActive && !this.hasSunk;
    }

    // Returns if the rock has finished its trajectory (either sunk or out of bounds)
    isFinished() {
        //return !this.isActive;
        return false;
    }
}