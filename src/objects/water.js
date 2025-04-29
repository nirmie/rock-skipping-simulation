import * as THREE from 'three';
import vertexShader from '../shaders/water_vertex.glsl?raw';
import fragmentShader from '../shaders/water_fragment.glsl?raw';

export default class Water extends THREE.Mesh {
    constructor(options) {
        super();
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uEnvironmentMap: { value: options.envMap },
                uTroughColor: { value: new THREE.Color('#186691')}, // blue 
                uSurfaceColor: { value: new THREE.Color('#9bd8c0')}, // blue
                uCrestColor: { value: new THREE.Color('#bbd8e0')}, // blue

                uOpacity: { value: 0.8 },
                uTime: { value: 0 },
                uWavesAmplitude: { value: 0.025},
                uWavesFrequency: { value: 1.07 },
                uWavesPersistence: { value: 0.3 },
                uWavesLacunarity: { value: 1.09 },
                uWavesIterations: { value: 8 },
                uWavesSpeed: { value: 0.4 },

                uTroughThreshold: { value: -0.01 }, // blue
                uTroughTransition: { value: 0.15 }, // blue
                uCrestThreshold: { value: 0.08 }, // blue
                uCrestTransition: { value: 0.05 }, // blue

                uFresnelStrength: { value: 0.8 },
                uFresnelPower: { value: 0.5 },
                
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            // wireframe: true,
        });
        this.geometry = new THREE.PlaneGeometry(2, 2, options.resolution, options.resolution);
        this.rotation.x = -Math.PI / 2;
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}