import * as THREE from 'three';
import vertexShader from '../shaders/ground_vertex.glsl?raw';
import fragmentShader from '../shaders/ground_fragment.glsl?raw';

const sandTexture = new THREE.TextureLoader().load('ocean_floor.png');

export default class Ground extends THREE.Mesh {
    constructor() {
        super();
        this.material = new THREE.ShaderMaterial({
            uniforms: {

                uTime: { value: 0.0 },
                uTexture: { value: sandTexture },
                uCausticsColor: {value : new THREE.Color(0xFFFFFF)}, // blue
                uCausticsSpeed: {value : 1.0}, // blue
                uCausticsScale: {value : 10.0}, // blue
                uCausticsIntensity: {value : 0.4}, // blue
                uCausticsOffset: { value: 0.42},
                uCausticsThickness: {value : 0.4},

                
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            // side: THREE.DoubleSide,
        });
        this.geometry = new THREE.PlaneGeometry(2, 10, 512, 512);
        this.rotation.x = -Math.PI / 2;
        this.position.y = -0.2;
        this.position.z= 5;
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}