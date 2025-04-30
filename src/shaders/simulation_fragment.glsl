precision highp float;

uniform sampler2D tPrev; // Previous frame's height/velocity data
uniform vec2 uResolution; // Resolution of the simulation texture
uniform float uDelta;     // Time delta (adjusted for simulation speed)
uniform float uViscosity; // Damping factor

// Click/Disturbance Input (reset each frame)
uniform bool uApplyDisturbance;
uniform vec2 uDisturbancePos; // UV coordinates (0-1)
uniform float uDisturbanceAmount;
uniform float uDisturbanceRadius;

varying vec2 vUv;

// Helper to get texture coordinates for neighbors
vec2 texel(vec2 offset) {
    return vUv + offset / uResolution;
}

void main() {
    // Read previous state (height in .r, velocity in .g)
    vec4 prevState = texture2D(tPrev, vUv);
    float height = prevState.r;
    float velocity = prevState.g;

    // --- Wave Equation (Finite Difference) ---
    // Sample neighbors
    float H_l = texture2D(tPrev, texel(vec2(-1.0, 0.0))).r; // Left
    float H_r = texture2D(tPrev, texel(vec2( 1.0, 0.0))).r; // Right
    float H_d = texture2D(tPrev, texel(vec2( 0.0,-1.0))).r; // Down (Top in UV)
    float H_u = texture2D(tPrev, texel(vec2( 0.0, 1.0))).r; // Up (Bottom in UV)

    // Calculate Laplacian (measure of curvature)
    float laplacian = (H_l + H_r + H_d + H_u) - 4.0 * height;

    // Update velocity based on acceleration (proportional to laplacian)
    // The uDelta factor scales the simulation speed
    float newVelocity = velocity + laplacian * uDelta;

    // Update height based on new velocity
    float newHeight = height + newVelocity * uDelta;

    // Apply damping (viscosity) to gradually reduce wave energy
    newHeight *= (1.0 - uViscosity * uDelta);
    newVelocity *= (1.0 - uViscosity * uDelta);


    // --- Boundary Conditions (Simple Reflection) ---
    // If a neighbor read was outside the texture (implicitly clamped to edge),
    // it simulates a fixed boundary. For reflection, you'd need more complex logic
    // or ensure the simulation area is slightly smaller than the texture.
    // This basic implementation implicitly handles fixed edges due to texture clamping.


    // --- Apply Disturbance (Click/Collision) ---
    if (uApplyDisturbance) {
        // Calculate distance from disturbance center (in UV space)
        float dist = distance(vUv, uDisturbancePos);
        float radius = uDisturbanceRadius; // Radius of the disturbance effect
        float strength = smoothstep(radius, 0.0, dist) * uDisturbanceAmount;

        // Add disturbance directly to height (can also affect velocity)
        newHeight += strength;
    }


    // Output new state (height in .r, velocity in .g)
    gl_FragColor = vec4(newHeight, newVelocity, 0.0, 1.0);
}