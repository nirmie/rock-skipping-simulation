\
uniform sampler2D uHeightMap;
uniform vec2 uResolution; // Resolution of the height map
uniform vec2 uCausticsResolution; // Resolution of this caustics map
uniform vec3 uLightDirection; // Normalized light direction in view space
uniform float uWaterDepth; // Virtual depth of the water body
uniform float uIntensity; // Caustics brightness multiplier

varying vec2 vUv;

// Helper function to get height and normal from the height map
vec3 getHeightAndNormal(vec2 uv) {
    float scale = 0.1; // Adjust based on height scale used in water vertex shader
    float epsilon = 1.0 / uResolution.x;

    float hL = texture2D(uHeightMap, vec2(uv.x - epsilon, uv.y)).r; // Height Left
    float hR = texture2D(uHeightMap, vec2(uv.x + epsilon, uv.y)).r; // Height Right
    float hD = texture2D(uHeightMap, vec2(uv.x, uv.y - epsilon)).r; // Height Down
    float hU = texture2D(uHeightMap, vec2(uv.x, uv.y + epsilon)).r; // Height Up

    float h = texture2D(uHeightMap, uv).r; // Center height

    vec3 normal = normalize(vec3( (hL - hR) * scale, (hD - hU) * scale, epsilon * 2.0));

    return vec3(h * scale, normal.xy); // Return height and normal components
}


void main() {
    // Calculate normal based on height map derivatives
    float epsilon = 1.0 / uResolution.x; // Pixel size in heightmap UV space
    float hL = texture2D(uHeightMap, vUv + vec2(-epsilon, 0.0)).r;
    float hR = texture2D(uHeightMap, vUv + vec2( epsilon, 0.0)).r;
    float hD = texture2D(uHeightMap, vUv + vec2( 0.0, -epsilon)).r;
    float hU = texture2D(uHeightMap, vUv + vec2( 0.0,  epsilon)).r;

    vec3 normal = normalize(vec3(hL - hR, hD - hU, epsilon * 2.0)); // Approximate normal

    // Simulate refraction (simplified Snell's law approximation)
    // Assuming light enters from air (n1=1.0) to water (n2=1.33)
    float eta = 1.0 / 1.33;
    vec3 refractedDir = refract(normalize(uLightDirection), normal, eta);

    // Project refracted ray onto the virtual "floor"
    // Calculate how far the ray travels in Z to reach the depth
    // This assumes the water surface is near z=0 and floor is at z=-uWaterDepth
    // We need the ray intersection point with the plane z = -uWaterDepth
    // Ray: P = surfacePoint + t * refractedDir
    // surfacePoint.z is approx 0 (or could use actual height, but small difference)
    // We want P.z = -uWaterDepth
    // 0 + t * refractedDir.z = -uWaterDepth
    // t = -uWaterDepth / refractedDir.z
    float t = -uWaterDepth / refractedDir.z;

    // Calculate intersection point in XY plane relative to the surface point (vUv)
    // IntersectionPoint.xy = surfacePoint.xy + t * refractedDir.xy
    // Since we are rendering to a texture, we map this intersection point back to UV space
    // The offset depends on the scale mapping UVs to world space. Assuming UV [0,1] maps to world [-planeSize/2, planeSize/2]
    // For simplicity, let's assume the offset in UV space is proportional to the XY component of the refracted dir scaled by t
    // This is an approximation, a more accurate projection depends on the exact world space setup.
    vec2 uvOffset = t * refractedDir.xy * 0.1; // The 0.1 is an arbitrary scale factor, adjust as needed!

    // The UV coordinate where this light ray hits the floor
    vec2 hitUv = vUv + uvOffset;

    // We are currently calculating the *outgoing* light from vUv.
    // To draw the caustics map, we need to know, for *this* fragment (vUv),
    // which surface points refracted light *here*. This is the reverse projection.
    // This is complex. A common approximation is to "splat" the light energy.
    // Each point on the surface (vUv) projects light to 'hitUv'.
    // We can't easily write *to* hitUv in a fragment shader.

    // --- Alternative: Screen-Space Approximation ---
    // Calculate how much the normal bends the light towards/away from the center of projection.
    // This is less physically accurate but often visually acceptable.
    // dot(normal, lightDir) affects intensity. Steeper angles refract more.
    float NdotL = dot(normal, normalize(uLightDirection));
    float refractionFactor = (1.0 - NdotL); // More light scattered if normal faces away from light

    // Simulate focusing/defocusing based on curvature (using finite differences again)
    float hC = texture2D(uHeightMap, vUv).r; // Center
    float laplacian = (hL + hR + hD + hU) - 4.0 * hC; // Measures curvature

    // Positive laplacian (concave up) focuses light, negative (convex up) disperses
    float focusFactor = -laplacian * 500.0; // Adjust scale factor
    focusFactor = clamp(focusFactor, -1.0, 5.0); // Clamp to prevent extreme values

    // Combine factors - this is heuristic
    float caustics = pow(max(0.0, 1.0 + focusFactor), 2.0) * uIntensity;
    // Add some base brightness modulated by refraction angle
    caustics += refractionFactor * 0.5 * uIntensity;


    // Clamp final value
    caustics = clamp(caustics, 0.0, uIntensity * 2.0); // Allow some bright spots

    // Output the caustics intensity (can use RGBA if storing more info)
    gl_FragColor = vec4(vec3(caustics), 1.0);

    // --- Note on more accurate methods ---
    // True caustics often involve multi-pass rendering or geometry shaders to "splat"
    // light energy onto the receiving surface based on the calculated hitUv.
    // The screen-space method above is a common performance trade-off.
}
