import * as THREE from 'three';

export default class Rock {
    constructor(options = {}) {
        // Default options
        this.options = {
            radius: options.radius || 0.05,
            segments: options.segments || 12,
            mass: options.mass || 0.1, // kg
            // REDUCED: Lower drag coefficient for less air resistance
            dragCoefficient: options.dragCoefficient || 0.2,
            elasticity: options.elasticity || 0.6, // Bounce factor
            minSkipVelocity: options.minSkipVelocity || 0.8, // Min velocity needed to skip
            waterPlaneSize: options.waterPlaneSize || { width: 2, height: 2 },
            skipsBeforeSink: options.skipsBeforeSink || 5, // Maximum skips before sinking
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
            this.options.segments,
            this.options.segments
        );

        // Deform vertices slightly for a more rock-like appearance
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3();
            vertex.fromBufferAttribute(positions, i);

            // Apply random deformation
            const noise = (Math.random() - 0.5) * 0.3;
            vertex.multiplyScalar(1 + noise * this.options.radius);

            // Update the vertex
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        // Update normals after deformation
        geometry.computeVertexNormals();

        // Create material (a simple gray material for now)
        const material = new THREE.MeshStandardMaterial({
            color: 0x7a7a7a,
            roughness: 0.8,
            metalness: 0.1,
        });

        // Create the mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Initialize position
        this.mesh.position.copy(this.position);
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.mesh.position.copy(this.position);
    }

    setVelocity(vx, vy, vz) {
        this.velocity.set(vx, vy, vz);
        // Store the initial velocity for logging
        this.initialVelocity.copy(this.velocity);
        console.log(`Rock initial velocity: (${vx.toFixed(2)}, ${vy.toFixed(2)}, ${vz.toFixed(2)}) - Magnitude: ${this.velocity.length().toFixed(2)}`);

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
        if (!this.isActive || this.hasSunk) return;

        // Use fixed time steps for more stable physics
        const fixedDeltaTime = Math.min(deltaTime, 1 / 30);

        // Log velocity periodically
        if (this.isActive && Date.now() - this.startTime > 500 && Date.now() % 500 < 50) {
            console.log(`Rock velocity after ${((Date.now() - this.startTime) / 1000).toFixed(1)}s: (${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}, ${this.velocity.z.toFixed(2)}) - Magnitude: ${this.velocity.length().toFixed(2)}`);
            console.log(`Rock position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
        }

        // Store previous position for collision detection
        const prevPosition = this.position.clone();

        // Apply gravity
        this.velocity.add(this.gravity.clone().multiplyScalar(fixedDeltaTime));

        // Apply drag with REDUCED coefficient
        const dragForce = this.velocity.clone().normalize().multiplyScalar(
            -0.1 * this.options.dragCoefficient * this.velocity.lengthSq() * fixedDeltaTime
        );
        this.velocity.add(dragForce.divideScalar(this.options.mass));

        // Update position based on velocity
        this.position.add(this.velocity.clone().multiplyScalar(fixedDeltaTime));

        // Update rotation based on angular velocity
        const rotationDelta = this.angularVelocity.clone().multiplyScalar(fixedDeltaTime);
        this.rotation.x += rotationDelta.x;
        this.rotation.y += rotationDelta.y;
        this.rotation.z += rotationDelta.z;

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);

        // Check for water collision
        this.checkWaterCollision(prevPosition, waterHeight, water, fixedDeltaTime);

        // Check for boundaries
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

            // Debug log the collision with velocity details
            console.log(`Rock collision at (${collisionPoint.x.toFixed(2)}, ${collisionPoint.y.toFixed(2)}, ${collisionPoint.z.toFixed(2)})`);
            console.log(`Impact velocity: ${impactVelocity.toFixed(2)} - Components: (${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}, ${this.velocity.z.toFixed(2)})`);

            // Only skip if velocity is above minimum threshold and we haven't exceeded max skips
            if (impactVelocity > this.options.minSkipVelocity && this.skipCount < this.options.skipsBeforeSink) {
                // Increment skip counter
                this.skipCount++;
                console.log(`Skip #${this.skipCount}`);

                // Calculate bounce effect - we want the rock to lose some energy but maintain forward momentum
                const bounceCoefficient = this.options.elasticity * (1 - (this.skipCount / this.options.skipsBeforeSink));

                // Reflect velocity vector but maintain some forward momentum
                this.velocity.y = -this.velocity.y * bounceCoefficient;

                // REDUCED: Less speed loss on skip for longer trajectories
                this.velocity.x *= 0.95; // Was 0.9
                this.velocity.z *= 0.95; // Was 0.9

                // Log post-bounce velocity
                console.log(`Post-bounce velocity: ${this.velocity.length().toFixed(2)} - Components: (${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}, ${this.velocity.z.toFixed(2)})`);

                // Apply random spin/rotation on collision
                this.angularVelocity.set(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                );

                // Create water disturbance at collision point
                if (water) {
                    // Calculate UV position from world position
                    const uvX = (collisionPoint.x / this.options.waterPlaneSize.width) + 0.5;
                    // Fixed negative Z for correct UV mapping
                    const uvY = (-collisionPoint.z / this.options.waterPlaneSize.height) + 0.5;

                    // Intensity based on impact velocity and rock size
                    const disturbanceIntensity = Math.min(
                        0.05,
                        0.01 + (impactVelocity / 20) * this.options.radius
                    );

                    // Add disturbance to water
                    water.addDisturbance(new THREE.Vector2(uvX, uvY), disturbanceIntensity);
                    console.log(`Creating ripple at UV (${uvX.toFixed(2)}, ${uvY.toFixed(2)}) with intensity ${disturbanceIntensity.toFixed(3)}`);
                }
            } else {
                // Rock has sunk
                this.hasSunk = true;
                console.log('Rock has sunk');

                // Create final splash disturbance
                if (water) {
                    const uvX = (collisionPoint.x / this.options.waterPlaneSize.width) + 0.5;
                    // Fixed negative Z for correct UV mapping
                    const uvY = (-collisionPoint.z / this.options.waterPlaneSize.height) + 0.5;

                    // Slightly bigger disturbance for sinking
                    water.addDisturbance(new THREE.Vector2(uvX, uvY), 0.03);
                    console.log(`Rock sinking at UV (${uvX.toFixed(2)}, ${uvY.toFixed(2)})`);
                }

                // Gradually sink the rock
                this.velocity.set(0, -0.2, 0); // Slow sinking velocity
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
            this.position.y < -1 || // Below ground
            Date.now() - this.startTime > 30000 // Maximum simulation time (30 seconds)
        ) {
            console.log(`Rock out of bounds or timeout. Position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
            this.isActive = false;
        }
    }

    // Returns if the rock is currently being simulated
    isSimulating() {
        return this.isActive && !this.hasSunk;
    }

    // Returns if the rock has finished its trajectory (either sunk or out of bounds)
    isFinished() {
        return !this.isActive || this.hasSunk;
    }
}