// File: /Users/nirmal/rock-skipping-simulation/src/shaders/ground_fragment.glsl
uniform sampler2D uTexture;
uniform sampler2D uCausticsMap;
uniform float uCausticsIntensity;
uniform vec2 uTextureRepeat;
uniform vec2 uPlaneSize; // Size of the water/ground plane (width, height)
uniform vec3 uPoolCenter;


varying vec2 vUv; // UV for the specific geometry (floor or wall)
varying vec3 vPosition; // World position of the fragment
varying vec3 vNormal; // Receive world normal

void main() {
  // --- Texture Mapping ---
  vec4 texColor = texture2D(uTexture, vUv * uTextureRepeat);
  // --- Determine if it's an inner surface (floor top or inner wall) ---
  // get vector from point to center of pool
  vec3 dirToCenter = normalize(uPoolCenter - vPosition);
    float isInside = step(0.0, dot(vNormal, dirToCenter));

  // --- Caustics Mapping ---
  vec2 potentialCausticsUv = vec2(
      (vPosition.x / uPlaneSize.x) + 0.5,
      (-vPosition.z / uPlaneSize.y) + 0.5 // Your corrected V coordinate
  );

  float causticsValue = 0.0; // Default to no caustics

  // Check if it's an inner surface AND within the XZ bounds of the water plane
  if (potentialCausticsUv.x >= 0.0 && potentialCausticsUv.x <= 1.0 &&
      potentialCausticsUv.y >= 0.0 && potentialCausticsUv.y <= 1.0 )
  {
      // If inside bounds and an inner surface, sample the caustics map
      vec2 causticsUv = potentialCausticsUv;
      causticsValue = texture2D(uCausticsMap, causticsUv).r; // Use the red channel
  }

  // Modulate the texture color by the caustics intensity
  vec3 finalColor = texColor.rgb * (1.0 + causticsValue * uCausticsIntensity);

  // Clamp the result
  finalColor = clamp(finalColor, 0.0, 1.5);

  gl_FragColor = vec4(finalColor, 1.0);
}