precision highp float;

uniform float uTime;
// Remove analytical wave/ripple uniforms if fully replaced
// uniform float uWavesAmplitude;
// uniform float uWavesFrequency;
// ... etc ...
// uniform float uLastClickTime;
// ... etc ...

// --- Add Height Map Uniform ---
uniform sampler2D uHeightMap;
uniform float uHeightScale; // To control the visual height exaggeration

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv; // Pass UV to fragment shader if needed for texturing

// Simplex noise function (snoise) can be removed if not used elsewhere

// Remove analytical elevation functions
// float calculateNoiseElevation(vec2 pos) { ... }
// float calculateRippleElevation(vec2 currentPos) { ... }

void main() {
    vUv = uv; // Store UV coordinates

    // --- Get Height from Simulation Texture ---
    // Sample height (stored in red channel) from the texture using vertex UVs
    float simulatedHeight = texture2D(uHeightMap, vUv).r;

    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // Apply the simulated height, scaled
    modelPosition.y += simulatedHeight * uHeightScale;


    // --- Normal Calculation from Height Map ---
    float texelSize = 1.0 / 256.0; // Adjust if SIMULATION_RESOLUTION changes
    float normalEpsilon = 0.001 * uHeightScale; // Small offset scaled by height

    // Sample height at neighboring UVs
    float hL = texture2D(uHeightMap, vUv + vec2(-texelSize, 0.0)).r * uHeightScale; // Left
    float hR = texture2D(uHeightMap, vUv + vec2( texelSize, 0.0)).r * uHeightScale; // Right
    float hD = texture2D(uHeightMap, vUv + vec2( 0.0, -texelSize)).r * uHeightScale; // Down (Top in UV)
    float hU = texture2D(uHeightMap, vUv + vec2( 0.0,  texelSize)).r * uHeightScale; // Up (Bottom in UV)

    // Calculate gradients (approximated) - Adjust X/Z scale based on plane dimensions if needed
    vec3 normal = vec3(
        (hL - hR) / (2.0 * texelSize), // dH/dU (maps roughly to dH/dX)
        1.0,                           // Assuming Y is up
        (hD - hU) / (2.0 * texelSize)  // dH/dV (maps roughly to dH/dZ)
    );

    // Transform normal to world space
    vNormal = normalize(normalMatrix * normalize(normal));


    vWorldPosition = modelPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
