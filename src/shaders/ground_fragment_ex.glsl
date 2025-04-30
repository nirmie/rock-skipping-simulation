uniform sampler2D uTexture;
uniform vec2 uTextureRepeat;


varying vec2 vUv; // UV for the specific geometry (floor or wall)

void main() {
  // --- Texture Mapping ---
  vec4 texColor = texture2D(uTexture, vUv * uTextureRepeat);

  // Clamp the result
  vec3 finalColor = clamp(texColor.rgb, 0.0, 1.5);

  gl_FragColor = vec4(finalColor, 1.0);
}