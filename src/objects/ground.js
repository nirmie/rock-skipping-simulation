import * as THREE from 'three';
import vertexShader from '../shaders/ground_vertex.glsl?raw';
import fragmentShader from '../shaders/ground_fragment.glsl?raw';

const sandTexture = new THREE.TextureLoader().load('ocean_floor.png');

export default class Ground extends THREE.Mesh {
    constructor(options) {
        super();
        this.groundPlaneSize = options.planeSize || { width: 2, height: 2 }; // Default or passed size
        this.material = new THREE.ShaderMaterial({
            uniforms: {

                uTime: { value: 0.0 },
                uTexture: { value: sandTexture },
                uCausticsColor: { value: new THREE.Color(0xFFFFFF) }, // blue
                uCausticsSpeed: { value: 1.0 }, // blue
                uCausticsScale: { value: 10.0 }, // blue
                uCausticsIntensity: { value: 0.4 }, // blue
                uCausticsOffset: { value: 0.42 },
                uCausticsThickness: { value: 0.4 },


            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            // side: THREE.DoubleSide,
        });
        this.geometry = new THREE.PlaneGeometry(this.groundPlaneSize.width,
            this.groundPlaneSize.height, 512, 512);
        this.rotation.x = -Math.PI / 2;
        this.position.y = -0.2;
        this.position.z = 5;
        this.position.z = this.groundPlaneSize.height / 2; // Adjust position based on size if needed
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}