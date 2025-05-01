import * as THREE from 'three';
import Rock from '../objects/rock';

export default class RockThrowController {
    constructor(options = {}) {
        // Reference to scene, camera and water surface
        this.scene = options.scene;
        this.camera = options.camera;
        this.water = options.water;
        this.waterPlaneSize = options.waterPlaneSize || { width: 2, height: 2 };

        // INCREASED: Higher base velocity for farther throws
        this.throwVelocity = options.throwVelocity || 12.0;

        // DOM element for event listeners
        this.domElement = options.domElement || document.body;

        // Current mouse position in normalized device coordinates
        this.mousePos = new THREE.Vector2();

        // Raycaster for cursor position
        this.raycaster = new THREE.Raycaster();

        // Rock pool - we'll reuse rocks instead of creating new ones each throw
        this.rockPool = [];
        this.activeRocks = [];
        this.rockPoolSize = options.rockPoolSize || 5;

        // Initialize rock pool
        this.initRockPool();

        // Position the throw near the bottom-left corner of the water
        // This allows us to throw across the entire pool
        this.throwPosition = new THREE.Vector3(
            0,
            0.5,                                // Slightly above water
            -this.waterPlaneSize.height * 0.5  // Bottom of pool
        );

        // Create visual aids
        this.createThrowPositionMarker();
        this.createTrajectoryLine();

        // Bind event handlers
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);

        // Add event listeners
        this.addEventListeners();

        // Debug mode for velocity logging
        this.debug = true;
    }

    initRockPool() {
        for (let i = 0; i < this.rockPoolSize; i++) {
            const rock = new Rock({
                waterPlaneSize: this.waterPlaneSize
            });
            this.rockPool.push(rock);
        }
    }

    // Add a visual marker to show where rocks are thrown from
    createThrowPositionMarker() {
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 0.7
        });
        this.throwMarker = new THREE.Mesh(geometry, material);
        this.throwMarker.position.copy(this.throwPosition);
        this.scene.add(this.throwMarker);
    }

    // Create a trajectory preview line
    createTrajectoryLine() {
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 0.1,
            gapSize: 0.05,
            transparent: true,
            opacity: 0.6
        });

        // Create geometry with initial points (will be updated in real-time)
        const points = this.predictTrajectory(this.throwPosition, new THREE.Vector3(0, 1, 0), 2);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        this.trajectoryLine = new THREE.Line(geometry, material);
        this.trajectoryLine.computeLineDistances(); // Required for dashed lines
        this.scene.add(this.trajectoryLine);
    }

    getRockFromPool() {
        // Return a rock from the pool or create a new one if needed
        if (this.rockPool.length > 0) {
            return this.rockPool.pop();
        } else {
            return new Rock({
                waterPlaneSize: this.waterPlaneSize
            });
        }
    }

    returnRockToPool(rock) {
        // Return a rock to the pool for reuse
        rock.reset();
        this.rockPool.push(rock);

        // Remove from active rocks
        const index = this.activeRocks.indexOf(rock);
        if (index !== -1) {
            this.activeRocks.splice(index, 1);
        }

        // Remove from scene
        this.scene.remove(rock.mesh);
    }

    addEventListeners() {
        // Listen for spacebar press to throw the rock
        window.addEventListener('keydown', this.onKeyDown);

        // Track mouse position
        this.domElement.addEventListener('mousemove', this.onMouseMove);
    }

    removeEventListeners() {
        window.removeEventListener('keydown', this.onKeyDown);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
    }

    onMouseMove(event) {
        // Store normalized mouse coordinates (-1 to +1)
        this.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update trajectory line
        this.updateTrajectoryLine();
    }

    onKeyDown(event) {
        // Check if spacebar was pressed
        if (event.key === ' ' || event.code === 'Space') {
            event.preventDefault(); // prevent scrolling
            this.throwRock();
        }
    }

    // Update the trajectory line based on current mouse position
    updateTrajectoryLine() {
        if (!this.trajectoryLine) return;

        // Raycasting setup
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const targetPoint = new THREE.Vector3();

        // Get intersection point with water plane
        if (this.raycaster.ray.intersectPlane(waterPlane, targetPoint)) {
            // Only continue if target is within water bounds
            if (
                targetPoint.x >= -this.waterPlaneSize.width / 2 &&
                targetPoint.x <= this.waterPlaneSize.width / 2 &&
                targetPoint.z >= -this.waterPlaneSize.height / 2 &&
                targetPoint.z <= this.waterPlaneSize.height / 2
            ) {
                // Calculate throw direction and distance
                const throwDirection = new THREE.Vector3().subVectors(targetPoint, this.throwPosition);
                const distance = throwDirection.length();

                if (this.debug && false) {
                    console.log(`Target distance: ${distance.toFixed(2)} at (${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)}, ${targetPoint.z.toFixed(2)})`);
                }

                throwDirection.normalize();

                // GREATLY IMPROVED: Use linear scaling based on distance
                // This ensures velocity correctly increases with distance
                // Calculate velocity 
                const velocityVector = this.calculateVelocityForTarget(throwDirection, distance);

                // Get predicted trajectory points
                const trajectoryPoints = this.predictTrajectory(
                    this.throwPosition,
                    velocityVector,
                    50 // Increased number of points for better visualization
                );

                // Update line geometry
                this.trajectoryLine.geometry.dispose();
                this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
                this.trajectoryLine.computeLineDistances();
                this.trajectoryLine.visible = true;
            } else {
                // Hide trajectory if target is outside water
                this.trajectoryLine.visible = false;
            }
        } else {
            // Hide trajectory if no intersection
            this.trajectoryLine.visible = false;
        }
    }

    // Calculate velocity vector for a given target
    calculateVelocityForTarget(direction, distance) {
        // OPTIMIZED: Better velocity scaling formula
        // Linear scaling based on distance with minimum and maximum caps
        const minVelocity = this.throwVelocity; // Base velocity for close targets
        const maxVelocity = this.throwVelocity * 5; // Maximum velocity for far targets
        const maxDistance = 15; // Distance at which we reach max velocity

        // Linear interpolation between min and max velocity based on distance
        const scaleVelocity = minVelocity + Math.min(distance / maxDistance, 1) * (maxVelocity - minVelocity);

        // Create velocity vector along direction
        const velocityVector = direction.clone().multiplyScalar(scaleVelocity);

        // Add upward component based on distance
        // More upward velocity for farther targets
        velocityVector.y += Math.min(0.5 + distance * 0.15, 3.0);

        if (this.debug && false) {
            console.log(`Calculated velocity: ${velocityVector.length().toFixed(2)} for distance: ${distance.toFixed(2)}`);
            console.log(`Velocity components: (${velocityVector.x.toFixed(2)}, ${velocityVector.y.toFixed(2)}, ${velocityVector.z.toFixed(2)})`);
        }

        return velocityVector;
    }

    // Predict trajectory based on starting position and velocity
    predictTrajectory(startPosition, velocity, steps = 50) {
        const points = [];
        const position = startPosition.clone();
        const vel = velocity.clone();
        // REDUCED: Match the reduced gravity from the Rock class
        const gravity = new THREE.Vector3(0, -4.9, 0);
        // REDUCED: Match the reduced drag from Rock class  
        const drag = 0.05;
        const timeStep = 0.1;

        // Add starting point
        points.push(position.clone());

        for (let i = 0; i < steps; i++) {
            // Apply gravity
            vel.add(gravity.clone().multiplyScalar(timeStep));

            // Apply drag
            const dragForce = vel.clone().normalize().multiplyScalar(
                -0.5 * drag * vel.lengthSq() * timeStep
            );
            vel.add(dragForce);

            // Update position
            position.add(vel.clone().multiplyScalar(timeStep));

            // Add point to trajectory
            points.push(position.clone());

            // Stop if we hit the water plane
            if (position.y < 0) {
                // Add one more point slightly below water for better visualization
                const waterHitPos = position.clone();
                waterHitPos.y = -0.05;
                points.push(waterHitPos);
                break;
            }
        }

        return points;
    }

    throwRock() {
        // Set up raycaster based on current mouse position
        this.raycaster.setFromCamera(this.mousePos, this.camera);

        // Create a plane representing the water surface (y=0)
        const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Calculate intersection point with the water plane
        const targetPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(waterPlane, targetPoint);

        // Check if intersection point is within water bounds
        if (
            targetPoint.x >= -this.waterPlaneSize.width / 2 &&
            targetPoint.x <= this.waterPlaneSize.width / 2 &&
            targetPoint.z >= -this.waterPlaneSize.height / 2 &&
            targetPoint.z <= this.waterPlaneSize.height / 2
        ) {
            // Get a rock from the pool
            const rock = this.getRockFromPool();

            // Set rock initial position
            rock.setPosition(this.throwPosition.x, this.throwPosition.y, this.throwPosition.z);

            // Calculate throw direction from throw position to target
            const throwDirection = new THREE.Vector3()
                .subVectors(targetPoint, this.throwPosition);

            // Calculate distance to target - this will determine throw strength
            const distance = throwDirection.length();

            // Log target information
            console.log(`Throwing rock at target: (${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)}, ${targetPoint.z.toFixed(2)})`);
            console.log(`Target distance: ${distance.toFixed(2)}`);

            // Normalize the direction vector
            throwDirection.normalize();

            // Use the common velocity calculation function
            const velocityVector = this.calculateVelocityForTarget(throwDirection, distance);

            // Apply velocity to rock
            rock.setVelocity(velocityVector.x, velocityVector.y, velocityVector.z);

            // Add to active rocks and scene
            this.activeRocks.push(rock);
            this.scene.add(rock.mesh);
        } else {
            console.log('Target out of bounds:', targetPoint);
        }
    }

    update(deltaTime) {
        // Update all active rocks
        for (let i = this.activeRocks.length - 1; i >= 0; i--) {
            const rock = this.activeRocks[i];

            // Update rock physics
            rock.update(deltaTime, 0, this.water);

            // Check if rock has finished its trajectory
            if (rock.isFinished()) {
                this.returnRockToPool(rock);
            }
        }
    }

    dispose() {
        // Clean up
        this.removeEventListeners();

        // Remove visual elements
        if (this.throwMarker) {
            this.scene.remove(this.throwMarker);
            this.throwMarker.geometry.dispose();
            this.throwMarker.material.dispose();
        }

        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.material.dispose();
        }

        // Return all active rocks to pool
        while (this.activeRocks.length > 0) {
            this.returnRockToPool(this.activeRocks[0]);
        }
    }
}