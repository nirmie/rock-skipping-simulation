precision highp float;

uniform float uTime;
uniform float uWavesAmplitude;
uniform float uWavesFrequency;
uniform float uWavesPersistence;
uniform float uWavesLacunarity;
uniform int uWavesIterations;
uniform float uWavesSpeed;

// --- Ripple Uniforms ---
uniform float uLastClickTime;
uniform vec2 uLastClickPosition;  // XZ position
uniform float uRippleSpeed;
uniform float uRippleFrequency;
uniform float uRippleAmplitude;
uniform float uRippleDecay;

varying vec3 vWorldPosition;
varying vec3 vNormal;

// Simplex 2D noise by Patricio Gonzalez
// https://gist.github.com/patriciogonzalezvivo/)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626,
                      0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p =
      permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(
      0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// takes x and z
float calculateNoiseElevation(vec2 pos) {
  float total_elevation = 0.0;
  float amplitude = uWavesAmplitude;
  float frequency = uWavesFrequency;
  for (int i = 0; i < uWavesIterations; i++) {
    total_elevation +=
        uWavesAmplitude * snoise(frequency * pos + uWavesSpeed * uTime);
    frequency *= uWavesLacunarity;
    amplitude *= uWavesPersistence;
  }
  return uWavesAmplitude * total_elevation;
}

// --- Calculate Ripple Elevation ---
float calculateRippleElevation(vec2 currentPos) {
  float rippleElevation = 0.0;
  float timeSinceClick = uTime - uLastClickTime;

  // Only calculate if click happened recently enough for ripple to be visible
  // and within a reasonable time frame (e.g., 5 seconds)
  if (timeSinceClick > 0.0 && timeSinceClick < 5.0) {
    float dist = distance(currentPos, uLastClickPosition);
    float rippleEffectTime =
        dist / uRippleSpeed;  // Time it takes ripple to reach this point

    // Only calculate if the ripple has reached this point
    if (timeSinceClick > rippleEffectTime) {
      float waveValue =
          cos((dist * uRippleFrequency) - (timeSinceClick * uRippleSpeed *
                                           uRippleFrequency));  // Ripple wave
      float decayFactor =
          exp(-dist * uRippleDecay -
              timeSinceClick * 0.5);  // Decay over distance and time
      // Fade out the start/end of the ripple pulse smoothly
      float pulseWidth = 0.5;  // Adjust width of the ripple pulse
      float pulseFactor =
          smoothstep(0.0, pulseWidth, timeSinceClick - rippleEffectTime) *
          smoothstep(
              pulseWidth + 1.0, 1.0,
              timeSinceClick - rippleEffectTime);  // Fade in/out based on how
                                                   // long ago ripple passed

      rippleElevation =
          waveValue * uRippleAmplitude * decayFactor * pulseFactor;
    }
  }
  return rippleElevation;
}

void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  float noiseElevation = calculateNoiseElevation(modelPosition.xz);

  // Calculate elevation from the last click ripple
  float rippleElevation = calculateRippleElevation(modelPosition.xz);

  // Combine elevations
  float totalElevation = noiseElevation + rippleElevation;

  modelPosition.y += totalElevation;

  float epsilon = 0.0001;
  vec3 pos = modelPosition.xyz;
 // Recalculate elevation at neighboring points including both noise and ripple
    float elevation_px = calculateNoiseElevation(vec2(pos.x + epsilon, pos.z)) + calculateRippleElevation(vec2(pos.x + epsilon, pos.z));
    float elevation_pz = calculateNoiseElevation(vec2(pos.x, pos.z + epsilon)) + calculateRippleElevation(vec2(pos.x, pos.z + epsilon));

    vec3 pos_px = vec3(pos.x + epsilon, elevation_px, pos.z);
    vec3 pos_pz = vec3(pos.x, elevation_pz, pos.z + epsilon);
    vec3 pos_current = vec3(pos.x, totalElevation, pos.z); // Use the calculated total elevation

    vec3 tangent = normalize(pos_px - pos_current);
    vec3 bitangent = normalize(pos_pz - pos_current);
    // Ensure correct normal direction (might need to flip based on winding order)
    vNormal = normalize(cross(bitangent, tangent)); // Flipped order often works for plane geometry


    vWorldPosition = modelPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}