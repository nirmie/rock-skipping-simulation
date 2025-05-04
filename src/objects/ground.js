import * as THREE from 'three';
import vertexShader from '../shaders/ground_vertex.glsl?raw';
import fragmentShader from '../shaders/ground_fragment.glsl?raw';
import exVertexShader from '../shaders/ground_vertex_ex.glsl?raw';
import exFragmentShader from '../shaders/ground_fragment_ex.glsl?raw';

// Export textures so they can be imported and used in UI
const sandTexture = new THREE.TextureLoader().load('ocean_floor.png');
sandTexture.wrapS = THREE.RepeatWrapping;
sandTexture.wrapT = THREE.RepeatWrapping;

const riverbedTexture = new THREE.TextureLoader().load('riverbed_bottom.png');
riverbedTexture.wrapS = THREE.RepeatWrapping;
riverbedTexture.wrapT = THREE.RepeatWrapping;

let texture = 'riverbed'; // Default texture
export { sandTexture, riverbedTexture, texture };

// Ground is now a Group containing the floor and walls
export default class Ground extends THREE.Group {
    constructor(options) {
        super();
        this.groundPlaneSize = options.planeSize || { width: 2, height: 2 };
        const wallHeight = -(options.floorDepth); // Height of walls (from floorDepth up to 0)



        // Shared Material for floor and walls
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uTexture: { value: riverbedTexture },
                uCausticsMap: { value: null },
                uCausticsIntensity: { value: 0.2 },
                uTextureRepeat: { value: new THREE.Vector2(5, 5) },
                // Pass plane size for calculating caustics UVs from world pos
                uPlaneSize: { value: new THREE.Vector2(this.groundPlaneSize.width, this.groundPlaneSize.height) },
                uPoolCenter: { value: new THREE.Vector3(0, 0, 0) }, // Center of the pool for caustics
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            // side: THREE.DoubleSide // Use DoubleSide if camera can go below floor
        });

        this.exteriorMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uTexture: { value: riverbedTexture },
                uTextureRepeat: { value: new THREE.Vector2(5, 5) },
            },
            vertexShader: exVertexShader,
            fragmentShader: exFragmentShader,
            // side: THREE.DoubleSide // Use DoubleSide if camera can go below floor
        });

        // --- Floor ---
        const floorGeometry = new THREE.PlaneGeometry(
            this.groundPlaneSize.width,
            this.groundPlaneSize.height,
            1, 1
        );
        const floorMesh = new THREE.Mesh(floorGeometry, this.material);
        floorMesh.rotation.x = - Math.PI / 2;
        floorMesh.position.y = options.floorDepth;
        floorMesh.receiveShadow = true;
        this.add(floorMesh);

        // --- Exterior Floor ---
        const exteriorFloorMesh = new THREE.Mesh(floorGeometry, this.exteriorMaterial);
        exteriorFloorMesh.rotation.x = Math.PI / 2;
        exteriorFloorMesh.position.y = options.floorDepth;
        exteriorFloorMesh.receiveShadow = true;
        this.add(exteriorFloorMesh);

        // --- Walls ---
        const wallMaterial = this.material; // Share the same material
        const exWallMaterial = this.exteriorMaterial; // Share the same exterior material

        // Wall X+
        const wallXPGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.height, wallHeight, 1, 1);
        const wallXPMesh = new THREE.Mesh(wallXPGeometry, wallMaterial);
        wallXPMesh.rotation.y = - Math.PI / 2;
        wallXPMesh.position.set(this.groundPlaneSize.width / 2, options.floorDepth + wallHeight / 2, 0);
        wallXPMesh.receiveShadow = true;
        this.add(wallXPMesh);

        // Wall X+  exterior
        const exWallXPGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.height, wallHeight, 1, 1);
        const exWallXPMesh = new THREE.Mesh(exWallXPGeometry, exWallMaterial);
        exWallXPMesh.rotation.y = Math.PI / 2;
        exWallXPMesh.position.set(this.groundPlaneSize.width / 2, options.floorDepth + wallHeight / 2, 0);
        exWallXPMesh.receiveShadow = true;
        this.add(exWallXPMesh);

        // Wall X-
        const wallXMGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.height, wallHeight, 1, 1);
        const wallXMMesh = new THREE.Mesh(wallXMGeometry, wallMaterial);
        wallXMMesh.rotation.y = Math.PI / 2;
        wallXMMesh.position.set(-this.groundPlaneSize.width / 2, options.floorDepth + wallHeight / 2, 0);
        wallXMMesh.receiveShadow = true;
        this.add(wallXMMesh);

        // Wall X- exterior
        const exWallXMGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.height, wallHeight, 1, 1);
        const exWallXMMesh = new THREE.Mesh(exWallXMGeometry, exWallMaterial);
        exWallXMMesh.rotation.y = - Math.PI / 2;
        exWallXMMesh.position.set(-this.groundPlaneSize.width / 2, options.floorDepth + wallHeight / 2, 0);
        exWallXMMesh.receiveShadow = true;
        this.add(exWallXMMesh);

        // Wall Z- (towards me)
        const wallZPGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.width, wallHeight, 1, 1);
        const wallZPMesh = new THREE.Mesh(wallZPGeometry, wallMaterial);
        // No rotation needed
        wallZPMesh.position.set(0, options.floorDepth + wallHeight / 2, -this.groundPlaneSize.height / 2);
        wallZPMesh.receiveShadow = true;
        this.add(wallZPMesh);

        // Wall Z- (towards me) exterior
        const exWallZPGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.width, wallHeight, 1, 1);
        const exWallZPMesh = new THREE.Mesh(exWallZPGeometry, exWallMaterial);
        exWallZPMesh.rotation.y = Math.PI;
        exWallZPMesh.position.set(0, options.floorDepth + wallHeight / 2, -this.groundPlaneSize.height / 2);
        exWallZPMesh.receiveShadow = true;
        this.add(exWallZPMesh);

        // Wall Z+ (far away)
        const wallZMGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.width, wallHeight, 1, 1);
        const wallZMMesh = new THREE.Mesh(wallZMGeometry, wallMaterial);
        wallZMMesh.rotation.y = Math.PI;
        wallZMMesh.position.set(0, options.floorDepth + wallHeight / 2, this.groundPlaneSize.height / 2);
        wallZMMesh.receiveShadow = true;
        this.add(wallZMMesh);

        // Wall Z+ (far away) exterior
        const exWallZMGeometry = new THREE.PlaneGeometry(this.groundPlaneSize.width, wallHeight, 1, 1);
        const exWallZMMesh = new THREE.Mesh(exWallZMGeometry, exWallMaterial);
        exWallZMMesh.position.set(0, options.floorDepth + wallHeight / 2, this.groundPlaneSize.height / 2);
        exWallZMMesh.receiveShadow = true;
        this.add(exWallZMMesh);


        // Set the group's position if needed (though individual meshes are positioned relative to the group origin)
        // this.position.z = this.groundPlaneSize.height / 2; // Adjust group position if needed
    }

    update(time) {
        // Update the shared material uniforms
        this.material.uniforms.uTime.value = time;
        // uCausticsMap is updated externally in main.js
    }
}