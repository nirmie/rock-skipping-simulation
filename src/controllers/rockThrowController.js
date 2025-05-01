import * as THREE from 'three';
import Rock from '../objects/rock';

export default class RockThrowController {
    constructor(options = {}) {
        // Reference to scene, camera and water surface
        this.scene = options.scene;
        this.camera = options.camera;
        this.water = options.water;
        this.waterPlaneSize = options.waterPlaneSize || { width: 2, height: 2 };

        // Fixed throw velocity for now
        this.throwVelocity = options.throwVelocity || 5.0;

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

        // Initial throw position (can be customized)
        this.throwPosition = new THREE.Vector3(0, 0.5, -5);

        // Bind event handlers
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);

        // Add event listeners
        this.addEventListeners();
    }

    initRockPool() {
        for (let i = 0; i < this.rockPoolSize; i++) {
            const rock = new Rock({
                waterPlaneSize: this.waterPlaneSize
            });
            this.rockPool.push(rock);
        }
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
    }

    onKeyDown(event) {
        // Check if spacebar was pressed (keyCode 32)
        if (event.key === ' ' || event.code === 'Space') {
            this.throwRock();
        }
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
            const throwDirection = new THREE.Vector3().subVectors(targetPoint, this.throwPosition)
            const distance = throwDirection.length();
            throwDirection.normalize();

            // Apply throw velocity along the direction
            const velocityVector = throwDirection.multiplyScalar(this.throwVelocity);
            velocityVector.z = distance * 5;

            // Add a bit of upward motion for better trajectories
            velocityVector.y += 0.5;

            // Apply velocity to rock
            rock.setVelocity(velocityVector.x, velocityVector.y, velocityVector.z);
            console.log('Rock velocity:', velocityVector);

            // Add to active rocks and scene
            this.activeRocks.push(rock);
            this.scene.add(rock.mesh);

            console.log('Rock thrown at:', targetPoint);
        } else {
            console.log('Target out of water bounds:', targetPoint);
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

        // Return all active rocks to pool
        while (this.activeRocks.length > 0) {
            this.returnRockToPool(this.activeRocks[0]);
        }
    }
}