import * as THREE from 'three';
import vertexShader from '../shaders/water_vertex.glsl?raw';
import fragmentShader from '../shaders/water_fragment.glsl?raw';

export default class Water extends THREE.Mesh {
    constructor(options) {
        super();
        this.material = new THREE.ShaderMaterial({
            uniforms: {

            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });
        this.geometry = new THREE.PlaneGeometry(2, 2, options.resolution, options.resolution);
    }
}